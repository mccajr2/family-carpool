-- Reuse one private Spotify merge playlist per connected adult (2+ open handoff).
ALTER TABLE spotify_connections
    ADD COLUMN merge_playlist_id VARCHAR(128);
