package main

import (
	"log"

	"codex-web/backend/internal/server"
)

func main() {
	app := server.New()
	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
