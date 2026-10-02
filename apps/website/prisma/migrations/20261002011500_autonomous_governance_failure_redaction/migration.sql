-- Older scheduler failures stored raw exception text. Retain a safe category only.
UPDATE "AutonomousGovernanceAutomationConfig"
SET "lastError" = 'EVALUATION_FAILED'
WHERE "lastError" IS NOT NULL
  AND "lastError" NOT IN (
    'DATABASE_UNAVAILABLE', 'DATABASE_TIMEOUT', 'DATABASE_ERROR',
    'DEPENDENCY_UNAVAILABLE', 'DEPENDENCY_TIMEOUT', 'EVALUATION_FAILED'
  );

UPDATE "AutonomousGovernanceAutomationRun"
SET "errorMessage" = 'EVALUATION_FAILED'
WHERE "errorMessage" IS NOT NULL
  AND "errorMessage" NOT IN (
    'DATABASE_UNAVAILABLE', 'DATABASE_TIMEOUT', 'DATABASE_ERROR',
    'DEPENDENCY_UNAVAILABLE', 'DEPENDENCY_TIMEOUT', 'EVALUATION_FAILED'
  );
