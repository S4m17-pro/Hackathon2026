-- Micro SDD v2: checklist, login, direccion, QR activo, cierre de visita,
-- coordenadas de novedad, y doble timestamp (`clientCreatedAt` + `receivedAt`).
--
-- Estrategia de datos existentes:
--   - `createdAt` -> `receivedAt` con CHANGE COLUMN, no DROP + ADD, para no
--     perder la hora de recepcion que ya estaba guardada.
--   - Las columnas NOT NULL nuevas se agregan como NULL, se rellenan y recien
--     ahi se pasan a NOT NULL. Asi la migracion corre sobre una base con datos.

-- ---------------------------------------------------------------------------
-- 1. Tablas nuevas primero: CostCenter y Visit van a referenciar
--    ChecklistTemplate, asi que el destino tiene que existir antes de la FK.
-- ---------------------------------------------------------------------------

CREATE TABLE `ChecklistTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ChecklistTemplate_name_idx`(`name`),
    INDEX `ChecklistTemplate_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ChecklistTemplateItem` (
    `id` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `costCenterId` VARCHAR(191) NULL,
    `label` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,
    `required` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ChecklistTemplateItem_templateId_idx`(`templateId`),
    INDEX `ChecklistTemplateItem_costCenterId_idx`(`costCenterId`),
    UNIQUE INDEX `ChecklistTemplateItem_templateId_position_key`(`templateId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Un item por (visita, item de plantilla). El UNIQUE es la segunda red contra
-- duplicados, ademas del upsert por clientId.
CREATE TABLE `ChecklistItemResult` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `visitId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'DONE', 'NOT_DONE') NOT NULL DEFAULT 'PENDING',
    `comment` TEXT NULL,
    `clientCreatedAt` DATETIME(3) NOT NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ChecklistItemResult_clientId_key`(`clientId`),
    INDEX `ChecklistItemResult_visitId_idx`(`visitId`),
    INDEX `ChecklistItemResult_status_idx`(`status`),
    INDEX `ChecklistItemResult_clientCreatedAt_idx`(`clientCreatedAt`),
    UNIQUE INDEX `ChecklistItemResult_visitId_itemId_key`(`visitId`, `itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 2. User: hash de contrasena (RF-AUT-01, RNF-07).
--    Se agrega nullable, se rellena y despues se vuelve NOT NULL.
--    Las cuentas que ya existian quedan con un hash invalido: no pueden
--    autenticarse hasta que el seed o un reset les fije una contrasena.
-- ---------------------------------------------------------------------------

ALTER TABLE `User` ADD COLUMN `passwordHash` VARCHAR(191) NULL;

UPDATE `User` SET `passwordHash` = 'LEGACY_NO_LOGIN' WHERE `passwordHash` IS NULL;

ALTER TABLE `User` MODIFY `passwordHash` VARCHAR(191) NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. CostCenter: direccion (RF-ASI-02) y plantilla por defecto (RF-ASI-03).
-- ---------------------------------------------------------------------------

ALTER TABLE `CostCenter`
    ADD COLUMN `address` VARCHAR(191) NULL,
    ADD COLUMN `checklistTemplateId` VARCHAR(191) NULL;

UPDATE `CostCenter` SET `address` = 'Direccion pendiente' WHERE `address` IS NULL;

ALTER TABLE `CostCenter` MODIFY `address` VARCHAR(191) NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. QrPoint: activacion/desactivacion (RF-QR-02) y radio default 50 m
--    (RF-QR-01). Los puntos existentes suben de 30 a 50: el seed viejo uso 30
--    contra lo que pide el SDD.
-- ---------------------------------------------------------------------------

ALTER TABLE `QrPoint`
    ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    MODIFY `radiusMeters` INTEGER NOT NULL DEFAULT 50;

UPDATE `QrPoint` SET `radiusMeters` = 50 WHERE `radiusMeters` = 30;

-- ---------------------------------------------------------------------------
-- 5. Visit: doble timestamp, geo con flag de fuera de rango, observaciones.
--    `createdAt` pasa a `receivedAt` conservando el valor.
-- ---------------------------------------------------------------------------

ALTER TABLE `Visit`
    CHANGE COLUMN `createdAt` `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `checkInAccuracyM` DOUBLE NULL,
    ADD COLUMN `checkInDistanceM` DOUBLE NULL,
    ADD COLUMN `checkInOutOfRange` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `checkInVerified` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `checkOutAccuracyM` DOUBLE NULL,
    ADD COLUMN `checkOutDistanceM` DOUBLE NULL,
    ADD COLUMN `checkOutNotes` TEXT NULL,
    ADD COLUMN `checkOutOutOfRange` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `checkOutVerified` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `checklistTemplateId` VARCHAR(191) NULL,
    ADD COLUMN `notes` TEXT NULL;

CREATE INDEX `Visit_checkInOutOfRange_idx` ON `Visit`(`checkInOutOfRange`);
CREATE INDEX `Visit_receivedAt_idx` ON `Visit`(`receivedAt`);

-- ---------------------------------------------------------------------------
-- 6. QrScan: doble timestamp. CA-05 necesita la hora del escaneo en campo.
-- ---------------------------------------------------------------------------

ALTER TABLE `QrScan`
    CHANGE COLUMN `createdAt` `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `clientCreatedAt` DATETIME(3) NULL;

UPDATE `QrScan` SET `clientCreatedAt` = `receivedAt` WHERE `clientCreatedAt` IS NULL;

ALTER TABLE `QrScan` MODIFY `clientCreatedAt` DATETIME(3) NOT NULL;

CREATE INDEX `QrScan_clientCreatedAt_idx` ON `QrScan`(`clientCreatedAt`);

-- ---------------------------------------------------------------------------
-- 7. Novelty: coordenadas (RF-NOV-01) y auditoria de cierre (RF-NOV-05).
-- ---------------------------------------------------------------------------

ALTER TABLE `Novelty`
    CHANGE COLUMN `createdAt` `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `closedAt` DATETIME(3) NULL,
    ADD COLUMN `closedById` VARCHAR(191) NULL,
    ADD COLUMN `lat` DOUBLE NULL,
    ADD COLUMN `lng` DOUBLE NULL,
    ADD COLUMN `resolutionAction` TEXT NULL;

CREATE INDEX `Novelty_receivedAt_idx` ON `Novelty`(`receivedAt`);

-- ---------------------------------------------------------------------------
-- 8. Evidence: doble timestamp y CHECKLIST_ITEM como dueño (RF-SUP-05).
-- ---------------------------------------------------------------------------

ALTER TABLE `Evidence`
    CHANGE COLUMN `createdAt` `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `ownerType` ENUM('VISIT', 'NOVELTY', 'QR_SCAN', 'CHECKLIST_ITEM') NOT NULL,
    ADD COLUMN `clientCreatedAt` DATETIME(3) NULL;

UPDATE `Evidence` SET `clientCreatedAt` = `receivedAt` WHERE `clientCreatedAt` IS NULL;

ALTER TABLE `Evidence` MODIFY `clientCreatedAt` DATETIME(3) NOT NULL;

CREATE INDEX `Evidence_clientCreatedAt_idx` ON `Evidence`(`clientCreatedAt`);

-- ---------------------------------------------------------------------------
-- 9. Indice de QR activos para la precarga de la PWA (RF-OFF-01).
-- ---------------------------------------------------------------------------

CREATE INDEX `QrPoint_isActive_idx` ON `QrPoint`(`isActive`);

-- ---------------------------------------------------------------------------
-- 10. Llaves foraneas.
-- ---------------------------------------------------------------------------

ALTER TABLE `CostCenter` ADD CONSTRAINT `CostCenter_checklistTemplateId_fkey` FOREIGN KEY (`checklistTemplateId`) REFERENCES `ChecklistTemplate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Visit` ADD CONSTRAINT `Visit_checklistTemplateId_fkey` FOREIGN KEY (`checklistTemplateId`) REFERENCES `ChecklistTemplate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Novelty` ADD CONSTRAINT `Novelty_closedById_fkey` FOREIGN KEY (`closedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ChecklistTemplate` ADD CONSTRAINT `ChecklistTemplate_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ChecklistTemplateItem` ADD CONSTRAINT `ChecklistTemplateItem_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `ChecklistTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ChecklistTemplateItem` ADD CONSTRAINT `ChecklistTemplateItem_costCenterId_fkey` FOREIGN KEY (`costCenterId`) REFERENCES `CostCenter`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ChecklistItemResult` ADD CONSTRAINT `ChecklistItemResult_visitId_fkey` FOREIGN KEY (`visitId`) REFERENCES `Visit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ChecklistItemResult` ADD CONSTRAINT `ChecklistItemResult_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `ChecklistTemplateItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;