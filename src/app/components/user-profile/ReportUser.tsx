import React, { FormEventHandler, useCallback, useMemo, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import { Method, Room } from 'matrix-js-sdk';
import {
  Box,
  Button,
  Chip,
  Dialog,
  Header,
  Icon,
  IconButton,
  Icons,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Spinner,
  Text,
  TextArea,
  color,
  config,
  toRem,
} from 'folds';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useSpecVersions } from '../../hooks/useSpecVersions';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';
import { stopPropagation } from '../../utils/keyboard';
import {
  buildUserReportReason,
  recentMessagesFrom,
} from '../../features/room/message/reportContext';

const REPORT_REASONS = [
  'Spam',
  'Harassment',
  'Hate speech',
  'Impersonation',
  'Illegal content',
  'Child safety',
  'Other',
];

// Reporting users was added in Matrix spec v1.14 (MSC4260).
export const useReportUserSupported = (): boolean => {
  const { versions, unstable_features: unstableFeatures } = useSpecVersions();
  return !!unstableFeatures?.['org.matrix.msc4260'] || versions.includes('v1.14');
};

const ATTACH_COUNTS = [0, 3, 5];

type ReportUserDialogProps = {
  userId: string;
  // The room the report was opened from; their recent messages here can be attached.
  room?: Room;
  open: boolean;
  onClose: () => void;
};
export function ReportUserDialog({ userId, room, open, onClose }: ReportUserDialogProps) {
  const mx = useMatrixClient();
  const supported = useReportUserSupported();
  const [category, setCategory] = useState<string>();
  const [details, setDetails] = useState('');
  const [attachCount, setAttachCount] = useState(0);

  const available = useMemo(
    () => (room ? recentMessagesFrom(room, userId, Math.max(...ATTACH_COUNTS)).length : 0),
    [room, userId]
  );
  const encrypted = !!room?.hasEncryptionStateEvent();
  const reason = details.trim() ? `${category ?? 'Reason'}: ${details.trim()}` : category ?? '';
  const built = useMemo(
    () =>
      buildUserReportReason(
        reason,
        userId,
        room?.roomId ?? '',
        room ? recentMessagesFrom(room, userId, attachCount) : []
      ),
    [reason, userId, room, attachCount]
  );

  const [reportState, report] = useAsyncCallback(
    useCallback(
      (text: string) =>
        mx.http.authedRequest(
          Method.Post,
          `/users/${encodeURIComponent(userId)}/report`,
          undefined,
          { reason: text }
        ),
      [mx, userId]
    )
  );
  const loading = reportState.status === AsyncStatus.Loading;
  const done = reportState.status === AsyncStatus.Success;

  const handleSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    if (!category || loading || done) return;
    report(built.text);
  };

  return (
    <Overlay open={open} backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            onDeactivate: onClose,
            clickOutsideDeactivates: true,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Dialog
            variant="Surface"
            style={{ width: attachCount > 0 ? 'min(94vw, 40rem)' : undefined, maxWidth: '94vw' }}
          >
            <Header
              style={{
                padding: `0 ${config.space.S200} 0 ${config.space.S400}`,
                borderBottomWidth: config.borderWidth.B300,
              }}
              variant="Surface"
              size="500"
            >
              <Box grow="Yes">
                <Text size="H4" truncate>
                  Report {userId}
                </Text>
              </Box>
              <IconButton size="300" onClick={onClose} radii="300" aria-label="Close">
                <Icon src={Icons.Cross} />
              </IconButton>
            </Header>
            {done ? (
              <Box style={{ padding: config.space.S400 }} direction="Column" gap="400">
                <Text size="T300">
                  Report sent to the server administrators. Thanks for helping keep things safe.
                </Text>
                <Button onClick={onClose}>
                  <Text size="B400">Done</Text>
                </Button>
              </Box>
            ) : (
              <Box
                as="form"
                onSubmit={handleSubmit}
                style={{ padding: config.space.S400 }}
                direction="Column"
                gap="400"
              >
                <Box direction="Column" gap="200">
                  <Text size="L400">Reason</Text>
                  <Box gap="200" wrap="Wrap">
                    {REPORT_REASONS.map((r) => (
                      <Chip
                        key={r}
                        type="button"
                        variant={category === r ? 'Critical' : 'SurfaceVariant'}
                        radii="Pill"
                        aria-pressed={category === r}
                        onClick={() => setCategory(r)}
                      >
                        <Text size="T200">{r}</Text>
                      </Chip>
                    ))}
                  </Box>
                </Box>
                <Box direction="Column" gap="100">
                  <Text size="L400">Details (optional)</Text>
                  <TextArea
                    name="detailsInput"
                    variant="Background"
                    radii="300"
                    rows={3}
                    maxLength={500}
                    value={details}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setDetails(e.target.value)
                    }
                  />
                </Box>
                {available > 0 && (
                  <Box direction="Column" gap="200">
                    <Text size="L400">Attach their messages from this room</Text>
                    <Box gap="200" wrap="Wrap">
                      {ATTACH_COUNTS.map((count) => (
                        <Chip
                          key={count}
                          type="button"
                          radii="Pill"
                          variant={attachCount === count ? 'Primary' : 'SurfaceVariant'}
                          aria-pressed={attachCount === count}
                          onClick={() => setAttachCount(count)}
                        >
                          <Text size="B300">{count === 0 ? 'None' : `Last ${count}`}</Text>
                        </Chip>
                      ))}
                    </Box>
                    {attachCount > 0 && encrypted && (
                      <Text
                        size="T300"
                        style={{
                          color: color.Critical.OnMain,
                          background: color.Critical.Main,
                          fontWeight: 400,
                          padding: config.space.S300,
                          borderRadius: config.radii.R300,
                        }}
                      >
                        Their messages here are end-to-end encrypted, so the server administrators
                        can&apos;t read them. This report will decrypt the chosen messages and send
                        them to the administrators.
                      </Text>
                    )}
                    {attachCount > 0 && (
                      <>
                        <Text size="L400">What will be sent</Text>
                        <Text
                          as="pre"
                          size="T200"
                          style={{
                            margin: 0,
                            maxHeight: `min(35vh, ${toRem(300)})`,
                            overflow: 'auto',
                            whiteSpace: 'pre-wrap',
                            overflowWrap: 'anywhere',
                            padding: config.space.S200,
                            borderRadius: config.radii.R300,
                            background: color.Background.Container,
                          }}
                        >
                          {built.text}
                        </Text>
                        {built.shared < Math.min(attachCount, available) && (
                          <Text size="T200" priority="300">
                            {`Only ${built.shared} fit, since servers cap user reports at 1000 characters. Report a single message to share more.`}
                          </Text>
                        )}
                      </>
                    )}
                  </Box>
                )}
                <Box
                  style={{
                    padding: config.space.S300,
                    borderRadius: config.radii.R400,
                    background: color.SurfaceVariant.Container,
                  }}
                  gap="200"
                  alignItems="Center"
                >
                  <Icon size="100" src={Icons.Info} />
                  <Text size="T200">This report will go to the server administrators.</Text>
                </Box>
                {!supported && (
                  <Text size="T200" style={{ color: color.Warning.Main }}>
                    Your server doesn&apos;t support reporting users yet. You can still report their
                    messages.
                  </Text>
                )}
                {reportState.status === AsyncStatus.Error && (
                  <Text size="T200" style={{ color: color.Critical.Main }}>
                    Failed to send report. Please try again.
                  </Text>
                )}
                <Button
                  type="submit"
                  variant="Critical"
                  disabled={!category || !supported || loading}
                  before={loading && <Spinner fill="Solid" variant="Critical" size="200" />}
                >
                  <Text size="B400">{loading ? 'Reporting...' : 'Report'}</Text>
                </Button>
              </Box>
            )}
          </Dialog>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}

export function ReportUserChip({ userId, room }: { userId: string; room?: Room }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Chip
        variant="SurfaceVariant"
        radii="Pill"
        before={<Icon size="50" src={Icons.Warning} />}
        onClick={() => setOpen(true)}
        aria-pressed={open}
      >
        <Text size="B300">Report</Text>
      </Chip>
      {open && <ReportUserDialog userId={userId} room={room} open onClose={() => setOpen(false)} />}
    </>
  );
}
