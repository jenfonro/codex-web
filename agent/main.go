package main

import (
	"context"
	"log"
	"os/signal"
	"syscall"

	"codex-web/agent/internal/agent"
	"codex-web/agent/internal/config"
)

func main() {
	cfg, err := config.LoadAgent()
	if err != nil {
		log.Fatal(err)
	}
	runner, err := agent.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	if err := runner.Run(ctx); err != nil && ctx.Err() == nil {
		log.Fatal(err)
	}
}
