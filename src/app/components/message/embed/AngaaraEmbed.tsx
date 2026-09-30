import React from 'react';
import { Box, Text } from 'folds';
import Linkify from 'linkify-react';
import { Opts } from 'linkifyjs';
import * as css from './AngaaraEmbed.css';

// Custom content key written by the angaara-bot SDK (bot-sdk/angaara-bot/src/content.rs).
export const EMBED_KEY = 'io.angaara.embed';
const LEGACY_EMBED_KEY = 'io.hearth.embed';

type EmbedField = { name: string; value: string; inline: boolean };
export type AngaaraEmbedData = {
  title?: string;
  description?: string;
  url?: string;
  color?: string;
  fields: EmbedField[];
  footer?: string;
};

const str = (v: unknown, max: number): string | undefined =>
  typeof v === 'string' && v.trim() ? v.slice(0, max) : undefined;

// Bot content is untrusted: keep only known fields, cap lengths, allow only http(s) links and hex colors.
export const parseEmbed = (content: Record<string, unknown>): AngaaraEmbedData | undefined => {
  const raw = content[EMBED_KEY] ?? content[LEGACY_EMBED_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const e = raw as Record<string, unknown>;
  const url = str(e.url, 2048);
  const embedColor = str(e.color, 9);
  const fields = (Array.isArray(e.fields) ? e.fields : [])
    .slice(0, 25)
    .flatMap((f): EmbedField[] => {
      if (!f || typeof f !== 'object') return [];
      const name = str((f as Record<string, unknown>).name, 256);
      const value = str((f as Record<string, unknown>).value, 1024);
      if (!name || !value) return [];
      return [{ name, value, inline: (f as Record<string, unknown>).inline === true }];
    });
  const embed: AngaaraEmbedData = {
    title: str(e.title, 256),
    description: str(e.description, 4096),
    url: url && /^https?:\/\//i.test(url) ? url : undefined,
    color: embedColor && /^#[0-9a-f]{6}$/i.test(embedColor) ? embedColor : undefined,
    fields,
    footer: str(e.footer, 2048),
  };
  if (!embed.title && !embed.description && !embed.footer && fields.length === 0) return undefined;
  return embed;
};

// Mirrors Embed::fallback_text, so the fallback can be cut from the body.
const fallbackText = (e: AngaaraEmbedData): string =>
  [e.title, e.description, ...e.fields.map((f) => `${f.name}: ${f.value}`), e.footer]
    .filter(Boolean)
    .join('\n');

export const embedLeadText = (body: string, e: AngaaraEmbedData): string => {
  const fallback = fallbackText(e);
  if (!body.endsWith(fallback)) return body;
  return body.slice(0, body.length - fallback.length).trim();
};

type AngaaraEmbedProps = {
  embed: AngaaraEmbedData;
  linkifyOpts: Opts;
};
export function AngaaraEmbed({ embed, linkifyOpts }: AngaaraEmbedProps) {
  const { title, description, url, fields, footer } = embed;
  return (
    <div className={css.Embed} style={embed.color ? { borderLeftColor: embed.color } : undefined}>
      {title && (
        <Text className={css.Title} size="T400">
          {url ? (
            <a href={url} target="_blank" rel="noreferrer noopener">
              {title}
            </a>
          ) : (
            title
          )}
        </Text>
      )}
      {description && (
        <Text className={css.Text} size="T300" priority="400">
          <Linkify options={linkifyOpts}>{description}</Linkify>
        </Text>
      )}
      {fields.length > 0 && (
        <div className={css.Fields}>
          {fields.map((field, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <Box key={i} className={css.Field} data-inline={field.inline} direction="Column">
              <Text size="L400">{field.name}</Text>
              <Text className={css.Text} size="T300" priority="400">
                <Linkify options={linkifyOpts}>{field.value}</Linkify>
              </Text>
            </Box>
          ))}
        </div>
      )}
      {footer && (
        <Text className={css.Text} size="T200" priority="300">
          {footer}
        </Text>
      )}
    </div>
  );
}
