# prisma

`schema.prisma` is the starting point for the application data model.

Before first migration:
1. Review enum names against the current implementation.
2. Review all optional fields against the real onboarding flow.
3. Decide whether to keep JSON-heavy sections or split them into typed relational tables.
4. Run `pnpm prisma:generate`.
5. Run `pnpm prisma:migrate`.
