package repository

import "testing"

func TestRepositorySatisfiesSegregatedInterfaces(t *testing.T) {
	repo := newTestRepo(t)

	if _, ok := repo.(MessageRepository); !ok {
		t.Fatalf("repository should satisfy MessageRepository")
	}
	if _, ok := repo.(UserRepository); !ok {
		t.Fatalf("repository should satisfy UserRepository")
	}
	if _, ok := repo.(ChatRepository); !ok {
		t.Fatalf("repository should satisfy ChatRepository")
	}
	if _, ok := repo.(ButlerRepository); !ok {
		t.Fatalf("repository should satisfy ButlerRepository")
	}
	if _, ok := repo.(BootstrapRepository); !ok {
		t.Fatalf("repository should satisfy BootstrapRepository")
	}
	if _, ok := repo.(MaintenanceRepository); !ok {
		t.Fatalf("repository should satisfy MaintenanceRepository")
	}
}
