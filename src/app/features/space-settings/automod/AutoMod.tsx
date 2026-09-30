import React, { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  color,
  config,
  Icon,
  IconButton,
  Icons,
  Input,
  Scroll,
  Spinner,
  Switch,
  Text,
  TextArea,
} from 'folds';
import { Page, PageContent, PageHeader } from '../../../components/page';
import { SequenceCard } from '../../../components/sequence-card';
import { SettingTile } from '../../../components/setting-tile';
import { SequenceCardStyle } from '../../room-settings/styles.css';
import { useRoom } from '../../../hooks/useRoom';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useStateEvent } from '../../../hooks/useStateEvent';
import { usePowerLevels } from '../../../hooks/usePowerLevels';
import { useRoomCreators } from '../../../hooks/useRoomCreators';
import { useRoomPermissions } from '../../../hooks/useRoomPermissions';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import { StateEvent } from '../../../../types/matrix/room';
import { AutoModRules, MAX_LIST, readAutoMod } from '../../automod';

const toText = (list: string[]) => list.join('\n');
const fromText = (text: string) =>
  text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_LIST);

type RuleCardProps = {
  title: string;
  description: string;
  on: boolean;
  onToggle: (on: boolean) => void;
  disabled: boolean;
  children?: ReactNode;
};
function RuleCard({ title, description, on, onToggle, disabled, children }: RuleCardProps) {
  return (
    <SequenceCard
      className={SequenceCardStyle}
      variant="SurfaceVariant"
      direction="Column"
      gap="300"
    >
      <SettingTile
        title={title}
        description={description}
        after={<Switch variant="Primary" value={on} onChange={onToggle} disabled={disabled} />}
      />
      {on && children}
    </SequenceCard>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box direction="Column" gap="100">
      <Text size="L400">{label}</Text>
      {children}
    </Box>
  );
}

type Draft = { rules: AutoModRules; words: string; links: string };

export function AutoMod({ requestClose }: { requestClose: () => void }) {
  const mx = useMatrixClient();
  const room = useRoom();
  const permissions = useRoomPermissions(useRoomCreators(room), usePowerLevels(room));
  const canEdit = permissions.stateEvent(StateEvent.AngaaraAutoMod, mx.getSafeUserId());
  const content = useStateEvent(room, StateEvent.AngaaraAutoMod)?.getContent();
  const saved = useMemo(() => readAutoMod(content), [content]);

  const fresh = useCallback(
    (): Draft => ({
      rules: saved,
      words: toText(saved.words.list),
      links: toText(saved.links.list),
    }),
    [saved]
  );
  const [draft, setDraft] = useState(fresh);
  useEffect(() => setDraft(fresh()), [fresh]);

  const next: AutoModRules = {
    ...draft.rules,
    words: { ...draft.rules.words, list: fromText(draft.words) },
    links: { ...draft.rules.links, list: fromText(draft.links) },
  };
  const dirty = JSON.stringify(readAutoMod(next)) !== JSON.stringify(saved);

  const [saveState, save] = useAsyncCallback(
    useCallback(
      (rules: AutoModRules) =>
        mx.sendStateEvent(room.roomId, StateEvent.AngaaraAutoMod as never, rules as never),
      [mx, room.roomId]
    )
  );
  const saving = saveState.status === AsyncStatus.Loading;
  const disabled = !canEdit || saving;

  const setRule = <K extends 'words' | 'links' | 'invites'>(
    key: K,
    change: Partial<AutoModRules[K]>
  ) => setDraft((d) => ({ ...d, rules: { ...d.rules, [key]: { ...d.rules[key], ...change } } }));

  const messageInput = (key: 'words' | 'links' | 'invites') => (
    <Field label="Message people see">
      <Input
        variant="Background"
        size="400"
        radii="300"
        maxLength={200}
        value={draft.rules[key].message}
        onChange={(e) => setRule(key, { message: e.currentTarget.value })}
        disabled={disabled}
      />
    </Field>
  );

  return (
    <Page>
      <PageHeader outlined={false}>
        <Box grow="Yes" gap="200">
          <Box grow="Yes" alignItems="Center" gap="200">
            <Text size="H3" truncate>
              AutoMod
            </Text>
          </Box>
          <Box shrink="No">
            <IconButton onClick={requestClose} variant="Surface">
              <Icon src={Icons.Cross} />
            </IconButton>
          </Box>
        </Box>
      </PageHeader>
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <Box direction="Column" gap="700">
              <SequenceCard
                className={SequenceCardStyle}
                variant="SurfaceVariant"
                direction="Column"
                gap="200"
              >
                <Box gap="200" alignItems="Center">
                  <Icon src={Icons.Shield} filled style={{ color: color.Primary.Main }} />
                  <Text size="H5">What AutoMod does</Text>
                </Box>
                <Text size="T300">
                  AutoMod checks every message against this server&apos;s rules before it&apos;s
                  sent. If a message breaks a rule, it isn&apos;t sent, and only the person who
                  wrote it sees why, along with your message.
                </Text>
                <Text as="ul" size="T300" style={{ margin: 0, paddingLeft: config.space.S500 }}>
                  <li>Works in every channel of this server, encrypted ones included.</li>
                  <li>Mods and admins are never blocked.</li>
                  <li>Slowmode is set per channel, in each channel&apos;s settings.</li>
                  <li>
                    Only Angaara follows these rules. To cover other Matrix apps too, use the
                    Angaara Bot below.
                  </li>
                </Text>
              </SequenceCard>

              <Box direction="Column" gap="100">
                <Text size="L400">Rules</Text>
                <RuleCard
                  title="Blocked Words"
                  description="Blocks messages with these words. Look-alike spellings like b4dw0rd are caught too, and a * at the end matches any ending, like scam*."
                  on={draft.rules.words.on}
                  onToggle={(on) => setRule('words', { on })}
                  disabled={disabled}
                >
                  <Field label="Words, one per line">
                    <TextArea
                      variant="Background"
                      radii="300"
                      rows={4}
                      value={draft.words}
                      onChange={(e) => {
                        const words = e.currentTarget.value;
                        setDraft((d) => ({ ...d, words }));
                      }}
                      disabled={disabled}
                    />
                  </Field>
                  {messageInput('words')}
                </RuleCard>
                <RuleCard
                  title="Blocked Links"
                  description="Blocks links to these sites, including their subdomains. Handy for GIF sites, link shorteners or known scam sites."
                  on={draft.rules.links.on}
                  onToggle={(on) => setRule('links', { on })}
                  disabled={disabled}
                >
                  <Field label="Sites, one per line (like tenor.com)">
                    <TextArea
                      variant="Background"
                      radii="300"
                      rows={4}
                      value={draft.links}
                      onChange={(e) => {
                        const links = e.currentTarget.value;
                        setDraft((d) => ({ ...d, links }));
                      }}
                      disabled={disabled}
                    />
                  </Field>
                  {messageInput('links')}
                </RuleCard>
                <RuleCard
                  title="Invite Links"
                  description="Blocks invites to other servers and group chats, like Telegram and WhatsApp groups or Matrix rooms."
                  on={draft.rules.invites.on}
                  onToggle={(on) => setRule('invites', { on })}
                  disabled={disabled}
                >
                  {messageInput('invites')}
                </RuleCard>
              </Box>

              <Box direction="Column" gap="100">
                <Text size="L400">Angaara Bot</Text>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Enforce for Every App"
                    description="AutoMod runs inside Angaara, so someone on another Matrix app could skip it. The Angaara Bot joins your server and removes messages that break the rules from any app: slowmode in every channel, and word, link and invite rules in unencrypted channels. It can't read encrypted messages and has no other powers."
                    after={
                      <Chip variant="Secondary" radii="Pill" outlined>
                        <Text size="L400">Coming Soon</Text>
                      </Chip>
                    }
                  />
                </SequenceCard>
              </Box>

              {canEdit && (
                <Box direction="Column" gap="200">
                  <Box gap="200">
                    <Button
                      variant="Primary"
                      size="400"
                      radii="300"
                      disabled={!dirty || saving}
                      onClick={() => save(readAutoMod(next))}
                      before={saving && <Spinner size="100" variant="Primary" fill="Solid" />}
                    >
                      <Text size="B400">Save Changes</Text>
                    </Button>
                    {dirty && !saving && (
                      <Button
                        variant="Secondary"
                        fill="Soft"
                        size="400"
                        radii="300"
                        onClick={() => setDraft(fresh())}
                      >
                        <Text size="B400">Reset</Text>
                      </Button>
                    )}
                  </Box>
                  {saveState.status === AsyncStatus.Error && (
                    <Text size="T200" style={{ color: color.Critical.Main }}>
                      Couldn&apos;t save: {(saveState.error as { message?: string }).message}
                    </Text>
                  )}
                </Box>
              )}
            </Box>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
