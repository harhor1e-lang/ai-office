-- Bind OAuth completion to the browser tab without relying on cross-site cookies.
ALTER TABLE oauth_states ADD COLUMN verifier_hash TEXT;
ALTER TABLE auth_codes ADD COLUMN verifier_hash TEXT;
