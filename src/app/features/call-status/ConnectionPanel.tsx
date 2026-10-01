import React, { useEffect, useState } from 'react';
import { Box, color, config, Icon, Icons, Text, toRem } from 'folds';
import { CallEmbed } from '../../plugins/call';
import { useAutoDiscoveryInfo } from '../../hooks/useAutoDiscoveryInfo';
import * as css from './ConnectionPanel.css';

type PairStats = { type: string; nominated?: boolean; currentRoundTripTime?: number };

const SAMPLES = 60;
const EVERY_MS = 2000;
const SLOW_MS = 200;

// Round trip to the voice server, read from the call's own WebRTC stats every two seconds.
const usePing = (embed: CallEmbed): number[] => {
  const [samples, setSamples] = useState<number[]>([]);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      let pcs: RTCPeerConnection[] = [];
      try {
        pcs =
          (embed.iframe.contentWindow as unknown as { __angaaraPcs?: RTCPeerConnection[] })
            ?.__angaaraPcs ?? [];
      } catch {
        pcs = [];
      }
      const rtts = await Promise.all(
        pcs.map(async (pc) => {
          let best: number | undefined;
          (await pc.getStats().catch(() => new Map())).forEach((r: PairStats) => {
            if (
              r.type === 'candidate-pair' &&
              r.nominated &&
              r.currentRoundTripTime !== undefined
            ) {
              best = Math.max(best ?? 0, r.currentRoundTripTime * 1000);
            }
          });
          return best;
        })
      );
      const found = rtts.filter((r): r is number => r !== undefined);
      if (alive && found.length > 0) {
        setSamples((s) => [...s.slice(1 - SAMPLES), Math.round(Math.max(...found))]);
      }
    };
    tick();
    const timer = window.setInterval(tick, EVERY_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [embed]);
  return samples;
};

function PingGraph({ samples, top }: { samples: number[]; top: number }) {
  const w = 300;
  const h = 64;
  const points = samples
    .map((v, i) => {
      const x =
        samples.length < 2
          ? w
          : (i / (SAMPLES - 1)) * w + (SAMPLES - samples.length) * (w / (SAMPLES - 1));
      return `${x.toFixed(1)},${(h - (Math.min(v, top) / top) * (h - 4) - 2).toFixed(1)}`;
    })
    .join(' ');
  return (
    <div className={css.Graph}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
        <line
          x1="0"
          x2={w}
          y1={h - (SLOW_MS / top) * (h - 4) - 2}
          y2={h - (SLOW_MS / top) * (h - 4) - 2}
          className={css.SlowLine}
        />
        {samples.length > 0 && <polyline points={points} className={css.Line} />}
      </svg>
      <span className={css.AxisTop}>{top}</span>
      <span className={css.AxisBottom}>0</span>
    </div>
  );
}

// Details behind "Voice Connected": live ping to the voice server and the call's encryption.
export function ConnectionPanel({ embed }: { embed: CallEmbed }) {
  const samples = usePing(embed);
  const foci = useAutoDiscoveryInfo()['org.matrix.msc4143.rtc_foci'];
  const serviceUrl = Array.isArray(foci)
    ? foci.find((f) => typeof f.livekit_service_url === 'string')?.livekit_service_url
    : undefined;
  let host = 'Voice server';
  try {
    if (serviceUrl) host = new URL(serviceUrl).host;
  } catch {
    host = 'Voice server';
  }
  const last = samples[samples.length - 1];
  const avg = samples.length
    ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)
    : undefined;
  const top = Math.max(500, Math.ceil(Math.max(0, ...samples) / 100) * 100);
  const encrypted = embed.room.hasEncryptionStateEvent();

  return (
    <div className={css.Panel}>
      <PingGraph samples={samples} top={top} />
      <Box direction="Column" gap="100" style={{ padding: `0 ${config.space.S100}` }}>
        <Text size="H6" truncate>
          {host}
        </Text>
        {avg === undefined ? (
          <Text size="T200" priority="300">
            Measuring ping…
          </Text>
        ) : (
          <>
            <Text size="T200">
              Average ping: <b>{avg} ms</b>
            </Text>
            <Text size="T200">
              Last ping:{' '}
              <b style={{ color: last >= SLOW_MS ? color.Warning.Main : undefined }}>{last} ms</b>
            </Text>
          </>
        )}
        <Text size="T200" priority="300" style={{ marginTop: toRem(4) }}>
          You may notice delayed audio at {SLOW_MS} ms or higher. If it keeps happening, disconnect
          and join again.
        </Text>
      </Box>
      <Box
        className={css.Secure}
        alignItems="Center"
        gap="200"
        style={{ color: encrypted ? color.Success.Main : color.Warning.Main }}
      >
        <Icon size="100" src={encrypted ? Icons.Lock : Icons.Warning} />
        <Text size="T200" style={{ color: 'inherit' }}>
          {encrypted ? `End-to-end encrypted · AES-${embed.keySize}` : 'Not end-to-end encrypted'}
        </Text>
      </Box>
    </div>
  );
}
