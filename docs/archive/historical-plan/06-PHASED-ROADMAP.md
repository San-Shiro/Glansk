# Phased Roadmap

## Completed
1. Application foundation, canvas CRUD, immutable publication.
2. Durable editor, geometry/content, optimistic concurrency.
3. Runtime preview, activation, status, restart, rollback, state transport.
4. Auth, grants, pairing/revocation, package trust, audit.
5. Backup, guarded reset/recovery, device broker, memory GPIO.
6. Responsive admin UI, installed-Chrome E2E, production build and smoke.

## Exit evidence
Typecheck passes; 24/24 unit/integration tests pass; 7/7 Chrome E2E tests pass; build and isolated production smoke pass. Reset uses exact one-use confirmation, backup/journal, and rollback.

## Remaining target validation
Physical GPIO electrical verification and WPE/Cog/Cage rendering and hardware performance. These are target tasks, not known code blockers.
