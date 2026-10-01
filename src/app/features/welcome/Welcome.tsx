import React, { useEffect, useMemo, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import { MatrixClient } from 'matrix-js-sdk';
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  color,
  config,
  Overlay,
  OverlayBackdrop,
  Scroll,
  Spinner,
  Text,
  toRem,
} from 'folds';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useAccountData } from '../../hooks/useAccountData';
import { useClientConfig } from '../../hooks/useClientConfig';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { usePhone } from '../../hooks/useScreenSize';
import { RoomSummaryLoader } from '../../components/RoomSummaryLoader';
import { RoomAvatar, RoomIcon } from '../../components/room-avatar';
import { AngaaraLogo } from '../../components/angaara-logo';
import { mxcUrlToHttp, getMxIdLocalPart } from '../../utils/matrix';
import { millify } from '../../plugins/millify';
import { requestWelcomeDm } from '../../../client/xp';
import { BRAND_NAME } from '../../brand';
import {
  clearNewAccount,
  isNewAccount,
  markNewAccount,
  takeMaybeNewAccount,
} from '../../utils/newAccount';

// Stored in account data so the welcome only shows once per account.
const WELCOME_KEY = 'io.angaara.welcome';

// An account fresh from signing up: no rooms, no other devices, and encryption never set up.
const isBrandNew = async (mx: MatrixClient): Promise<boolean> => {
  if (mx.getRooms().some((r) => r.getMyMembership() === 'join')) return false;
  const { devices } = await mx.getDevices();
  if (devices.length > 1) return false;
  const keys = await Promise.all(
    ['m.secret_storage.default_key', 'm.cross_signing.master'].map((type) =>
      mx.getAccountDataFromServer(type as never).catch(() => null)
    )
  );
  return keys.every((k) => !k);
};

type Step = 'hello' | 'interests' | 'servers' | 'done';
const STEPS: Step[] = ['hello', 'interests', 'servers', 'done'];

function Dots({ step }: { step: Step }) {
  return (
    <Box gap="100" justifyContent="Center">
      {STEPS.map((s) => (
        <span
          key={s}
          style={{
            width: toRem(s === step ? 20 : 8),
            height: toRem(8),
            borderRadius: toRem(4),
            transition: 'width 200ms',
            background: s === step ? color.Primary.Main : color.SurfaceVariant.ContainerLine,
          }}
        />
      ))}
    </Box>
  );
}

type ServerRowProps = {
  alias: string;
  checked: boolean;
  onToggle: () => void;
};
function ServerRow({ alias, checked, onToggle }: ServerRowProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  return (
    <RoomSummaryLoader roomIdOrAlias={alias}>
      {(summary) => {
        const joined = !!summary && mx.getRoom(summary.room_id)?.getMyMembership() === 'join';
        const name = summary?.name || alias;
        const avatarUrl = summary?.avatar_url
          ? mxcUrlToHttp(mx, summary.avatar_url, useAuthentication, 96, 96, 'crop') ?? undefined
          : undefined;
        return (
          <Box
            as="label"
            alignItems="Center"
            gap="300"
            style={{
              padding: config.space.S300,
              borderRadius: config.radii.R400,
              background:
                checked && !joined
                  ? color.SurfaceVariant.ContainerActive
                  : color.SurfaceVariant.Container,
              cursor: joined ? 'default' : 'pointer',
            }}
          >
            <Avatar size="300">
              <RoomAvatar
                roomId={summary?.room_id ?? alias}
                src={avatarUrl}
                alt={name}
                renderFallback={() => <RoomIcon size="200" roomType={summary?.room_type} />}
              />
            </Avatar>
            <Box grow="Yes" direction="Column" gap="100" style={{ minWidth: 0 }}>
              <Text size="T300" truncate>
                <b>{name}</b>
              </Text>
              <Text size="T200" priority="300" truncate>
                {summary
                  ? `${millify(summary.num_joined_members)} Members${
                      summary.topic ? ` · ${summary.topic}` : ''
                    }`
                  : alias}
              </Text>
            </Box>
            {joined ? (
              <Text size="T200" priority="300">
                Joined
              </Text>
            ) : (
              <Checkbox
                checked={checked}
                onClick={onToggle}
                variant="Primary"
                size="200"
                aria-label={`Join ${name}`}
              />
            )}
          </Box>
        );
      }}
    </RoomSummaryLoader>
  );
}

export function Welcome() {
  const mx = useMatrixClient();
  const phone = usePhone();
  const { welcome } = useClientConfig();
  const seen = !!useAccountData(WELCOME_KEY)?.getContent()?.done;
  const [closed, setClosed] = useState(false);
  const [step, setStep] = useState<Step>('hello');
  const [interests, setInterests] = useState<string[]>([]);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(welcome?.rooms ?? []));
  const [joining, setJoining] = useState(false);
  const [failed, setFailed] = useState(0);
  const [dmSent, setDmSent] = useState(false);
  const userId = mx.getSafeUserId();
  // Only for new sign-ups (here or through single sign-on), never for logging in.
  const [isNew, setIsNew] = useState(() => isNewAccount(userId));
  useEffect(() => {
    if (isNew || !takeMaybeNewAccount(userId)) return;
    isBrandNew(mx)
      .then((fresh) => {
        if (!fresh) return;
        markNewAccount(userId);
        setIsNew(true);
      })
      .catch(() => undefined);
  }, [mx, userId, isNew]);
  const open = isNew && !seen && !closed;

  // Without a display name set, Matrix hands back the full ID; the username reads nicer.
  const displayName = mx.getUser(userId)?.displayName;
  const name =
    (displayName && displayName !== userId ? displayName : getMxIdLocalPart(userId)) || userId;

  useEffect(() => {
    if (!open) return;
    requestWelcomeDm(mx)
      .then((status) => setDmSent(status === 'sent'))
      .catch(() => undefined);
  }, [open, mx]);

  const suggested = useMemo(() => {
    const chosen = (welcome?.interests ?? []).filter((i) => interests.includes(i.id));
    return [...new Set([...(welcome?.rooms ?? []), ...chosen.flatMap((i) => i.rooms)])];
  }, [welcome, interests]);

  if (!open) return null;

  const finish = () => {
    setClosed(true);
    clearNewAccount();
    mx.setAccountData(WELCOME_KEY as never, { done: true, interests } as never).catch(
      () => undefined
    );
  };

  const toggleInterest = (id: string) => {
    const on = !interests.includes(id);
    setInterests(on ? [...interests, id] : interests.filter((i) => i !== id));
    const rooms = welcome?.interests?.find((i) => i.id === id)?.rooms ?? [];
    setPicked((prev) => {
      const next = new Set(prev);
      rooms.forEach((r) => (on ? next.add(r) : next.delete(r)));
      return next;
    });
  };

  const togglePicked = (alias: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(alias)) next.delete(alias);
      else next.add(alias);
      return next;
    });

  const joinPicked = async () => {
    const targets = suggested.filter((alias) => picked.has(alias));
    setJoining(true);
    const results = await Promise.allSettled(targets.map((alias) => mx.joinRoom(alias)));
    setFailed(results.filter((r) => r.status === 'rejected').length);
    setJoining(false);
    setStep('done');
  };

  const toJoin = suggested.filter((alias) => picked.has(alias)).length;

  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      <Box
        grow="Yes"
        alignItems="Center"
        justifyContent="Center"
        style={{ height: '100%', padding: phone ? 0 : config.space.S400 }}
      >
        <FocusTrap focusTrapOptions={{ initialFocus: false, escapeDeactivates: false }}>
          <Box
            direction="Column"
            style={{
              width: '100%',
              maxWidth: phone ? undefined : toRem(480),
              height: phone ? '100%' : undefined,
              maxHeight: phone ? undefined : toRem(640),
              borderRadius: phone ? 0 : config.radii.R500,
              background: color.Surface.Container,
              color: color.Surface.OnContainer,
              overflow: 'hidden',
            }}
          >
            <Box shrink="No" style={{ height: config.space.S500 }} />
            <Box grow="Yes" direction="Column" style={{ minHeight: 0 }}>
              <Scroll size="300" hideTrack visibility="Hover">
                <Box
                  direction="Column"
                  gap="500"
                  style={{ padding: `0 ${config.space.S500} ${config.space.S500}` }}
                >
                  {step === 'hello' && (
                    <Box direction="Column" alignItems="Center" gap="400">
                      <AngaaraLogo size={80} animated />
                      <Text size="H2" align="Center">
                        Welcome to {BRAND_NAME}, {name}!
                      </Text>
                      <Text size="T400" align="Center" priority="400">
                        Your communities, on an open network. Let&apos;s set things up, it only
                        takes a few seconds.
                      </Text>
                      {dmSent && (
                        <Text size="T300" align="Center" priority="300">
                          📬 The {BRAND_NAME} bot just said hi in your DMs.
                        </Text>
                      )}
                    </Box>
                  )}
                  {step === 'interests' && (
                    <Box direction="Column" gap="400">
                      <Box direction="Column" gap="100">
                        <Text size="H3">What are you into?</Text>
                        <Text size="T300" priority="400">
                          Pick as many as you like and we&apos;ll suggest some servers.
                        </Text>
                      </Box>
                      <Box
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                          gap: config.space.S200,
                        }}
                      >
                        {(welcome?.interests ?? []).map((interest) => {
                          const on = interests.includes(interest.id);
                          return (
                            <Button
                              key={interest.id}
                              variant={on ? 'Primary' : 'Secondary'}
                              fill={on ? 'Solid' : 'Soft'}
                              radii="400"
                              aria-pressed={on}
                              onClick={() => toggleInterest(interest.id)}
                              style={{ height: toRem(64), justifyContent: 'flex-start' }}
                              before={<span style={{ fontSize: toRem(22) }}>{interest.emoji}</span>}
                            >
                              <Text size="B400" truncate>
                                {interest.label}
                              </Text>
                            </Button>
                          );
                        })}
                      </Box>
                    </Box>
                  )}
                  {step === 'servers' && (
                    <Box direction="Column" gap="400">
                      <Box direction="Column" gap="100">
                        <Text size="H3">Servers you might like</Text>
                        <Text size="T300" priority="400">
                          Tick the ones you want to join. You can always find more in Explore.
                        </Text>
                      </Box>
                      <Box direction="Column" gap="200">
                        {suggested.map((alias) => (
                          <ServerRow
                            key={alias}
                            alias={alias}
                            checked={picked.has(alias)}
                            onToggle={() => togglePicked(alias)}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                  {step === 'done' && (
                    <Box direction="Column" alignItems="Center" gap="400">
                      <Text size="H1">🎉</Text>
                      <Text size="H2" align="Center">
                        You&apos;re all set!
                      </Text>
                      <Text size="T400" align="Center" priority="400">
                        Your servers are in the bar on the left. Go say hi, add some friends and
                        have fun.
                      </Text>
                      {failed > 0 && (
                        <Text size="T300" align="Center" style={{ color: color.Critical.Main }}>
                          {failed === 1
                            ? "One server couldn't be joined. Try it again from Explore."
                            : `${failed} servers couldn't be joined. Try them again from Explore.`}
                        </Text>
                      )}
                    </Box>
                  )}
                </Box>
              </Scroll>
            </Box>
            <Box
              direction="Column"
              gap="300"
              style={{
                padding: config.space.S500,
                borderTop: `${config.borderWidth.B300} solid ${color.Surface.ContainerLine}`,
              }}
            >
              <Dots step={step} />
              <Box gap="200">
                {(step === 'interests' || step === 'servers') && (
                  <Button
                    variant="Secondary"
                    fill="None"
                    disabled={joining}
                    onClick={() => setStep(step === 'servers' ? 'interests' : 'hello')}
                  >
                    <Text size="B400">Back</Text>
                  </Button>
                )}
                <Box grow="Yes" />
                {step === 'hello' && (
                  <Button variant="Primary" onClick={() => setStep('interests')}>
                    <Text size="B400">Let&apos;s go</Text>
                  </Button>
                )}
                {step === 'interests' && (
                  <Button variant="Primary" onClick={() => setStep('servers')}>
                    <Text size="B400">{interests.length > 0 ? 'Next' : 'Skip'}</Text>
                  </Button>
                )}
                {step === 'servers' && (
                  <Button
                    variant="Primary"
                    disabled={joining}
                    onClick={joinPicked}
                    before={joining && <Spinner size="100" variant="Primary" fill="Solid" />}
                  >
                    <Text size="B400">{toJoin > 0 ? 'Join & continue' : 'Continue'}</Text>
                  </Button>
                )}
                {step === 'done' && (
                  <Button variant="Primary" onClick={finish}>
                    <Text size="B400">Start chatting</Text>
                  </Button>
                )}
              </Box>
            </Box>
          </Box>
        </FocusTrap>
      </Box>
    </Overlay>
  );
}
