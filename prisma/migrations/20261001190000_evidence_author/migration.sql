-- RNF-14: la evidencia guarda quien la envio. Nullable para filas viejas.
-- El servidor lo llena con la sesion del supervisor, no con el payload.

ALTER TABLE `Evidence` ADD COLUMN `capturedById` VARCHAR(191) NULL;

CREATE INDEX `Evidence_capturedById_idx` ON `Evidence`(`capturedById`);

ALTER TABLE `Evidence` ADD CONSTRAINT `Evidence_capturedById_fkey` FOREIGN KEY (`capturedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
