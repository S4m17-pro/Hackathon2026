-- Permisos para la shadow database de Prisma.
--
-- `prisma migrate dev` crea una base temporal para detectar drift antes de
-- aplicar una migracion. El usuario que corre la app necesita CREATE DATABASE
-- para eso, no solo permisos sobre la base `supervision`. Sin este script,
-- `npm run db:migrate` falla con P3014.
--
-- RNF-13: el entorno tiene que levantarse reproducible con un solo comando.
-- Este script corre automaticamente la primera vez que se crea el volumen.

GRANT CREATE, DROP ON *.* TO 'supervision'@'%';
FLUSH PRIVILEGES;