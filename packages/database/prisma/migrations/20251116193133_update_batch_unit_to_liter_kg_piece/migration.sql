-- Step 1: Add PIECE to the existing enum
ALTER TYPE "BatchUnit" ADD VALUE IF NOT EXISTS 'PIECE';

-- Step 2: Update existing records using BAG or BOTTLE to PIECE
UPDATE batches SET unit = 'PIECE' WHERE unit IN ('BAG', 'BOTTLE');
UPDATE raw_materials SET unit = 'PIECE' WHERE unit IN ('BAG', 'BOTTLE');
UPDATE bom_items SET unit = 'PIECE' WHERE unit IN ('BAG', 'BOTTLE');
UPDATE raw_material_batches SET unit = 'PIECE' WHERE unit IN ('BAG', 'BOTTLE');

-- Step 3: Create new enum with only LITER, KG, PIECE
CREATE TYPE "BatchUnit_new" AS ENUM ('LITER', 'KG', 'PIECE');

-- Step 4: Alter all tables to use the new enum
ALTER TABLE batches ALTER COLUMN unit TYPE "BatchUnit_new" USING unit::text::"BatchUnit_new";
ALTER TABLE raw_materials ALTER COLUMN unit TYPE "BatchUnit_new" USING unit::text::"BatchUnit_new";
ALTER TABLE bom_items ALTER COLUMN unit TYPE "BatchUnit_new" USING unit::text::"BatchUnit_new";
ALTER TABLE raw_material_batches ALTER COLUMN unit TYPE "BatchUnit_new" USING unit::text::"BatchUnit_new";

-- Step 5: Drop old enum
DROP TYPE "BatchUnit";

-- Step 6: Rename new enum to original name
ALTER TYPE "BatchUnit_new" RENAME TO "BatchUnit";
