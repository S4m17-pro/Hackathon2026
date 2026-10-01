-- RF-ASI-01: el coordinador programa y cancela visitas.
-- `scheduledAt` es nullable: una visita nacida en el dispositivo puede no
-- tener horario de oficina. `CANCELLED` solo lo escribe el coordinador.

ALTER TABLE `Visit`
    MODIFY `status` ENUM('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'ASSIGNED';

ALTER TABLE `Visit` ADD COLUMN `scheduledAt` DATETIME(3) NULL;

CREATE INDEX `Visit_scheduledAt_idx` ON `Visit`(`scheduledAt`);
