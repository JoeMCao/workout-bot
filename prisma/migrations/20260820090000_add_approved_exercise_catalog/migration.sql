-- Approved canonical exercises are the only records planning and logging may use.
ALTER TABLE "Exercise"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'approved';

CREATE TABLE "ExerciseAlias" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExerciseAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExerciseAlias_normalizedName_key"
ON "ExerciseAlias"("normalizedName");

CREATE INDEX "ExerciseAlias_exerciseId_idx"
ON "ExerciseAlias"("exerciseId");

ALTER TABLE "ExerciseAlias"
ADD CONSTRAINT "ExerciseAlias_exerciseId_fkey"
FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Consolidate confirmed overlapping history into one comparable progression record.
UPDATE "ExerciseSet"
SET "exerciseId" = (SELECT "id" FROM "Exercise" WHERE "name" = 'Chest-Supported Dumbbell Row')
WHERE "exerciseId" IN (
  SELECT "id" FROM "Exercise"
  WHERE "name" IN ('Chest Supported Row', 'Chest-Supported DB Row')
)
AND EXISTS (SELECT 1 FROM "Exercise" WHERE "name" = 'Chest-Supported Dumbbell Row');

UPDATE "ExerciseSet"
SET "exerciseId" = (SELECT "id" FROM "Exercise" WHERE "name" = 'Incline Dumbbell Press')
WHERE "exerciseId" IN (
  SELECT "id" FROM "Exercise" WHERE "name" = 'Incline DB Press'
)
AND EXISTS (SELECT 1 FROM "Exercise" WHERE "name" = 'Incline Dumbbell Press');

UPDATE "ExerciseSet"
SET "exerciseId" = (SELECT "id" FROM "Exercise" WHERE "name" = 'Dumbbell Hip Thrust')
WHERE "exerciseId" IN (
  SELECT "id" FROM "Exercise" WHERE "name" = 'Hip Thrust'
)
AND EXISTS (SELECT 1 FROM "Exercise" WHERE "name" = 'Dumbbell Hip Thrust');

UPDATE "ExerciseSet"
SET "exerciseId" = (SELECT "id" FROM "Exercise" WHERE "name" = 'Pull-Up')
WHERE "exerciseId" IN (
  SELECT "id" FROM "Exercise" WHERE "name" = 'Neutral-Grip Pull-Up'
)
AND EXISTS (SELECT 1 FROM "Exercise" WHERE "name" = 'Pull-Up');

-- Canonicalize any persisted plan names from the same confirmed clusters.
UPDATE "TrainingSlot" AS slot
SET "exerciseNames" = (
  SELECT jsonb_agg(
    CASE item.value
      WHEN 'Chest Supported Row' THEN 'Chest-Supported Dumbbell Row'
      WHEN 'Chest-Supported DB Row' THEN 'Chest-Supported Dumbbell Row'
      WHEN 'Incline DB Press' THEN 'Incline Dumbbell Press'
      WHEN 'Hip Thrust' THEN 'Dumbbell Hip Thrust'
      WHEN 'Neutral-Grip Pull-Up' THEN 'Pull-Up'
      ELSE item.value
    END
    ORDER BY item.ordinality
  )
  FROM jsonb_array_elements_text(slot."exerciseNames") WITH ORDINALITY AS item(value, ordinality)
)
WHERE slot."exerciseNames" IS NOT NULL
  AND jsonb_typeof(slot."exerciseNames") = 'array';

-- Retain source catalog rows as a recoverable audit trail after their history is reassigned.
UPDATE "Exercise"
SET "status" = 'merged'
WHERE "name" IN (
  'Chest Supported Row',
  'Chest-Supported DB Row',
  'Incline DB Press',
  'Hip Thrust',
  'Neutral-Grip Pull-Up'
);

-- These were never performed and are too ambiguous to be approved planning choices.
UPDATE "Exercise"
SET "status" = 'inactive'
WHERE "name" IN ('Dumbbell Row', 'Assisted Pull-Up (Neutral Grip)')
  AND NOT EXISTS (
    SELECT 1 FROM "ExerciseSet" WHERE "ExerciseSet"."exerciseId" = "Exercise"."id"
  );

-- Every approved canonical exercise resolves through a normalized self-alias.
INSERT INTO "ExerciseAlias" (
  "id", "exerciseId", "name", "normalizedName", "createdAt", "updatedAt"
)
SELECT
  'alias_' || md5(exercise."id"),
  exercise."id",
  exercise."name",
  trim(
    regexp_replace(
      regexp_replace(
        lower(translate(exercise."name", '‐‑‒–—', '-----')),
        '[-_/()]+',
        ' ',
        'g'
      ),
      '\s+',
      ' ',
      'g'
    )
  ),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Exercise" AS exercise
WHERE exercise."status" = 'approved'
ON CONFLICT ("normalizedName") DO NOTHING;

-- Preserve historical labels and common user phrasing without recreating duplicates.
INSERT INTO "ExerciseAlias" (
  "id", "exerciseId", "name", "normalizedName", "createdAt", "updatedAt"
)
SELECT
  'alias_' || md5(alias_data.alias_name || target."id"),
  target."id",
  alias_data.alias_name,
  alias_data.normalized_name,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  VALUES
    ('Chest Supported Row', 'chest supported row', 'Chest-Supported Dumbbell Row'),
    ('Hip Thrust', 'hip thrust', 'Dumbbell Hip Thrust'),
    ('Neutral-Grip Pull-Up', 'neutral grip pull up', 'Pull-Up'),
    ('Single-Arm Dumbbell Row', 'single arm dumbbell row', 'One-Arm Dumbbell Row')
) AS alias_data(alias_name, normalized_name, target_name)
JOIN "Exercise" AS target ON target."name" = alias_data.target_name
ON CONFLICT ("normalizedName") DO NOTHING;
