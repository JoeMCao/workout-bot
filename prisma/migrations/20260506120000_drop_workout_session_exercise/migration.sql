-- Merge WorkoutSessionExercise displayName + notes into each matching ExerciseSet.notes, then drop metadata table.

UPDATE "ExerciseSet" AS es
SET "notes" = TRIM(
  BOTH FROM CONCAT_WS(
    E'\n\n',
    NULLIF(TRIM(es."notes"), ''),
    NULLIF(
      TRIM(
        CONCAT_WS(
          E'\n',
          NULLIF(TRIM(wse."displayName"), ''),
          NULLIF(TRIM(wse."notes"), '')
        )
      ),
      ''
    )
  )
)
FROM "WorkoutSessionExercise" AS wse
WHERE es."sessionId" = wse."sessionId"
  AND es."exerciseId" = wse."exerciseId"
  AND (
    NULLIF(TRIM(wse."displayName"), '') IS NOT NULL
    OR NULLIF(TRIM(wse."notes"), '') IS NOT NULL
  );

DROP TABLE IF EXISTS "WorkoutSessionExercise";
