-- Invite code for family circles (one active code per circle).
ALTER TABLE family_circles
    ADD COLUMN invite_code VARCHAR(16);

UPDATE family_circles
SET invite_code = UPPER(SUBSTRING(REPLACE(id::text, '-', '') FROM 1 FOR 8))
WHERE invite_code IS NULL;

ALTER TABLE family_circles
    ALTER COLUMN invite_code SET NOT NULL;

CREATE UNIQUE INDEX family_circles_invite_code_uidx ON family_circles (invite_code);
