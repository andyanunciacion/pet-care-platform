-- UUID v7 (RFC 9562): the first 48 bits are a millisecond Unix timestamp, so ids sort by
-- creation time and new rows land at the end of indexes. Postgres 18 ships uuidv7();
-- until we're on 18, this builds one from a random v4 UUID:
--   1. overwrite bytes 1–6 with the current time in milliseconds (big-endian), then
--   2. change the version nibble from 4 (0100) to 7 (0111) by setting bits 52 and 53.
-- The v4 UUID already has the right variant bits. Used as the default for every id column.
CREATE FUNCTION uuid_generate_v7() RETURNS uuid
LANGUAGE sql VOLATILE PARALLEL SAFE
AS $$
  SELECT encode(
    set_bit(
      set_bit(
        overlay(
          uuid_send(gen_random_uuid())
          PLACING substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
          FROM 1 FOR 6
        ),
        52, 1
      ),
      53, 1
    ),
    'hex'
  )::uuid
$$;
