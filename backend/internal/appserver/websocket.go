package appserver

import (
	"bufio"
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha1"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
)

type websocketConn struct {
	conn    net.Conn
	reader  *bufio.Reader
	writeMu sync.Mutex
}

func dialWebSocket(ctx context.Context, endpoint string) (*websocketConn, error) {
	target, err := url.Parse(endpoint)
	if err != nil {
		return nil, err
	}
	var conn net.Conn
	host := target.Host
	requestPath := target.RequestURI()
	if requestPath == "" {
		requestPath = "/"
	}
	switch target.Scheme {
	case "unix":
		path := strings.TrimPrefix(endpoint, "unix://")
		if path == "" {
			return nil, errors.New("Codex app-server unix socket path is empty")
		}
		conn, err = (&net.Dialer{}).DialContext(ctx, "unix", path)
		host = "localhost"
		requestPath = "/"
	case "ws":
		if host == "" {
			return nil, errors.New("Codex app-server websocket host is empty")
		}
		conn, err = (&net.Dialer{}).DialContext(ctx, "tcp", host)
	default:
		return nil, fmt.Errorf("unsupported Codex app-server endpoint %q", endpoint)
	}
	if err != nil {
		return nil, err
	}
	ws := &websocketConn{conn: conn, reader: bufio.NewReader(conn)}
	if err := ws.handshake(host, requestPath); err != nil {
		_ = conn.Close()
		return nil, err
	}
	return ws, nil
}

func (w *websocketConn) handshake(host, requestPath string) error {
	keyBytes := make([]byte, 16)
	if _, err := rand.Read(keyBytes); err != nil {
		return err
	}
	key := base64.StdEncoding.EncodeToString(keyBytes)
	request := strings.Join([]string{
		"GET " + requestPath + " HTTP/1.1",
		"Host: " + host,
		"Upgrade: websocket",
		"Connection: Upgrade",
		"Sec-WebSocket-Version: 13",
		"Sec-WebSocket-Key: " + key,
		"",
		"",
	}, "\r\n")
	if _, err := io.WriteString(w.conn, request); err != nil {
		return err
	}
	response, err := http.ReadResponse(w.reader, &http.Request{Method: http.MethodGet})
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusSwitchingProtocols {
		return fmt.Errorf("websocket upgrade failed: %s", response.Status)
	}
	if !strings.EqualFold(response.Header.Get("Upgrade"), "websocket") {
		return errors.New("websocket upgrade missing Upgrade header")
	}
	expected := websocketAcceptKey(key)
	if response.Header.Get("Sec-WebSocket-Accept") != expected {
		return errors.New("websocket upgrade returned invalid accept key")
	}
	return nil
}

func websocketAcceptKey(key string) string {
	sum := sha1.Sum([]byte(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"))
	return base64.StdEncoding.EncodeToString(sum[:])
}

func (w *websocketConn) Close() error {
	return w.conn.Close()
}

func (w *websocketConn) sendText(data []byte) error {
	return w.writeFrame(0x1, data)
}

func (w *websocketConn) sendPong(data []byte) error {
	return w.writeFrame(0xA, data)
}

func (w *websocketConn) writeFrame(opcode byte, payload []byte) error {
	w.writeMu.Lock()
	defer w.writeMu.Unlock()
	header := []byte{0x80 | opcode}
	length := len(payload)
	switch {
	case length < 126:
		header = append(header, 0x80|byte(length))
	case length <= 0xFFFF:
		header = append(header, 0x80|126, byte(length>>8), byte(length))
	default:
		header = append(header, 0x80|127)
		var encoded [8]byte
		binary.BigEndian.PutUint64(encoded[:], uint64(length))
		header = append(header, encoded[:]...)
	}
	mask := make([]byte, 4)
	if _, err := rand.Read(mask); err != nil {
		return err
	}
	header = append(header, mask...)
	masked := make([]byte, length)
	for i, item := range payload {
		masked[i] = item ^ mask[i%4]
	}
	if _, err := w.conn.Write(header); err != nil {
		return err
	}
	_, err := w.conn.Write(masked)
	return err
}

func (w *websocketConn) readMessage() ([]byte, error) {
	var message bytes.Buffer
	for {
		fin, opcode, payload, err := w.readFrame()
		if err != nil {
			return nil, err
		}
		switch opcode {
		case 0x0, 0x1, 0x2:
			message.Write(payload)
			if fin {
				return message.Bytes(), nil
			}
		case 0x8:
			return nil, io.EOF
		case 0x9:
			if err := w.sendPong(payload); err != nil {
				return nil, err
			}
		case 0xA:
			continue
		default:
			return nil, fmt.Errorf("unsupported websocket opcode %d", opcode)
		}
	}
}

func (w *websocketConn) readFrame() (bool, byte, []byte, error) {
	first, err := w.reader.ReadByte()
	if err != nil {
		return false, 0, nil, err
	}
	second, err := w.reader.ReadByte()
	if err != nil {
		return false, 0, nil, err
	}
	fin := first&0x80 != 0
	opcode := first & 0x0F
	masked := second&0x80 != 0
	length := uint64(second & 0x7F)
	if length == 126 {
		var encoded [2]byte
		if _, err := io.ReadFull(w.reader, encoded[:]); err != nil {
			return false, 0, nil, err
		}
		length = uint64(binary.BigEndian.Uint16(encoded[:]))
	} else if length == 127 {
		var encoded [8]byte
		if _, err := io.ReadFull(w.reader, encoded[:]); err != nil {
			return false, 0, nil, err
		}
		length = binary.BigEndian.Uint64(encoded[:])
	}
	var mask [4]byte
	if masked {
		if _, err := io.ReadFull(w.reader, mask[:]); err != nil {
			return false, 0, nil, err
		}
	}
	if length > 64*1024*1024 {
		return false, 0, nil, errors.New("websocket message too large")
	}
	payload := make([]byte, int(length))
	if _, err := io.ReadFull(w.reader, payload); err != nil {
		return false, 0, nil, err
	}
	if masked {
		for i := range payload {
			payload[i] ^= mask[i%4]
		}
	}
	return fin, opcode, payload, nil
}
