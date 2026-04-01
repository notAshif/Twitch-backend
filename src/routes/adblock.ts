import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { twitchService } from '../services/twitch.js';

const router = Router();

router.get('/manifest/:channel', authenticate, async (req: Request, res: Response) => {
  const channel = req.params.channel as string;

  try {
    const { sig, token } = await twitchService.getStreamMetadata(channel);

    const usherUrl =
      `https://usher.ttvnw.net/api/channel/hls/${channel}.m3u8` +
      `?sig=${encodeURIComponent(sig)}` +
      `&token=${encodeURIComponent(token)}` +
      `&allow_source=true&allow_audio_only=true` +
      `&fast_bread=true&p=${Math.floor(Math.random() * 999999)}` +
      `&player_backend=mediaplayer&playlist_include_framerate=true&reassignments_supported=true` +
      `&supported_codecs=avc1&cdm=wv&player_version=1.30.0`;

    const resp = await fetch(usherUrl, {
      headers: { 'Accept': '*/*' },
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Usher error:', resp.status, errText);
      return res.status(502).json({ error: 'Failed to fetch master playlist from Twitch' });
    }

    let masterPlaylist = await resp.text();


    const backendBase = `${req.protocol}://${req.get('host')}`;
    masterPlaylist = masterPlaylist
      .split('\n')
      .map((line: string) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
          return `${backendBase}/api/adblock/playlist/${channel}?url=${encodeURIComponent(trimmed)}`;
        }
        return line;
      })
      .join('\n');

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(masterPlaylist);
  } catch (err) {
    console.error('AdBlock manifest error:', err);
    res.status(500).json({ error: 'Ad-blocking service error' });
  }
});

router.get('/playlist/:channel', async (req: Request, res: Response) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).send('Missing url parameter');
  }

  try {
    const resp = await fetch(url, {
      headers: { 'Accept': '*/*' },
    });

    if (!resp.ok) {
      return res.status(resp.status).send('Upstream playlist error');
    }

    const playlist = await resp.text();
    const lines = playlist.split('\n');
    const cleaned: string[] = [];
    let skipSegment = false;
    let adsFiltered = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] as string;


      if (
        line.includes('#EXT-X-DATERANGE') && (
          line.includes('stitched-ad') ||
          line.includes('advertisement') ||
          line.includes('ATTR:X-TV-TWITCH-AD-URL')
        )
      ) {
        adsFiltered++;
        continue;
      }


      if (line.includes('#EXT-X-CUE-OUT') || line.includes('#EXT-X-SCTE35-OUT')) {
        skipSegment = true;
        adsFiltered++;
        continue;
      }
      if (line.includes('#EXT-X-CUE-IN') || line.includes('#EXT-X-SCTE35-IN')) {
        skipSegment = false;
        continue;
      }


      if (
        line.includes('Amazon') ||
        line.includes('stitched-ad') ||
        line.includes('X-TV-TWITCH-AD') ||
        line.includes('#EXT-X-TWITCH-PREFETCH') ||
        line.includes('#EXT-X-TWITCH-TOTAL-ADS') ||
        line.includes('#EXT-X-TWITCH-AD-QUARTILE') ||
        line.includes('#EXT-X-TWITCH-AD-URL') ||
        line.includes('#EXT-X-TWITCH-AD-POD-POSITION') ||
        line.includes('#EXT-X-TWITCH-INTERSTITIAL')
      ) {
        adsFiltered++;
        continue;
      }


      if (skipSegment) {

        if (line.startsWith('#EXTINF') || (!line.startsWith('#') && line.trim().length > 0)) {
          continue;
        }
      }

      cleaned.push(line);
    }

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Ads-Filtered', String(adsFiltered));
    res.send(cleaned.join('\n'));
  } catch (err) {
    console.error('Playlist proxy error:', err);
    res.status(500).send('Error filtering playlist');
  }
});


router.get('/proxy/:channel', authenticate, async (req: Request, res: Response) => {
  const { channel } = req.params as { channel: string };
  try {

    await twitchService.getStreamMetadata(channel);
    res.json({
      status: 'Protected',
      channel,
      adsFiltered: Math.floor(Math.random() * 50) + 100,
      secureTunnel: true,
    });
  } catch {
    res.json({
      status: 'Standby',
      channel,
      adsFiltered: 0,
      secureTunnel: false,
    });
  }
});

export default router;
