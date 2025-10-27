package utils

import "log"

func Close(c interface{ Close() error }, context string) {
	if err := c.Close(); err != nil {
		log.Printf("Error closing %s: %v", context, err)
	}
}
