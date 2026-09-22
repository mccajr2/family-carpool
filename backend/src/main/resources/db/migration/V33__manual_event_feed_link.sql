-- Optional team (activity feed) link on manual events. Removing the feed
-- unlinks the one-off; it does not delete it.
ALTER TABLE manual_events
    ADD COLUMN feed_id UUID REFERENCES activity_feeds (id) ON DELETE SET NULL;

CREATE INDEX manual_events_circle_feed_id_idx ON manual_events (circle_id, feed_id)
    WHERE feed_id IS NOT NULL;
