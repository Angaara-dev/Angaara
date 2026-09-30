import React, { useState } from 'react';
import {
  Badge,
  Box,
  Button,
  color,
  config,
  Header,
  Icon,
  IconButton,
  Icons,
  Scroll,
  Spinner,
  Text,
} from 'folds';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import {
  AppReport,
  BugReport,
  bugTypeLabel,
  listBugReports,
  listReports,
  archiveBugReport,
  reopenBugReport,
  resolveReport,
} from './reports';
import { MarkdownText } from './MarkdownText';
import { Modal500 } from '../../components/Modal500';
import { BUG_REPORTS_KEY, useMarkBugsSeen } from './bugPing';

function ReportItem({ report, onDone }: { report: AppReport; onDone: (id: number) => void }) {
  const mx = useMatrixClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const done = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await resolveReport(mx, report.id);
      onDone(report.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't mark it done.");
      setBusy(false);
    }
  };

  return (
    <Box
      direction="Column"
      gap="200"
      style={{
        padding: config.space.S400,
        borderRadius: config.radii.R400,
        background: color.SurfaceVariant.Container,
      }}
    >
      <Box alignItems="Start" gap="300">
        <Box direction="Column" gap="100" grow="Yes" style={{ minWidth: 0 }}>
          <Text size="T300" style={{ overflowWrap: 'anywhere' }}>
            <b>{report.message || 'Unknown error'}</b>
          </Text>
          <Text size="T200" priority="300" style={{ overflowWrap: 'anywhere' }}>
            {new Date(report.at).toLocaleString()} · {report.path ?? 'unknown page'} ·{' '}
            {report.build ?? 'unknown build'}
          </Text>
        </Box>
        <Button size="300" variant="Success" fill="Soft" radii="300" disabled={busy} onClick={done}>
          <Text size="B300">Done</Text>
        </Button>
      </Box>
      {report.note && (
        <Text size="T300" style={{ overflowWrap: 'anywhere' }}>
          “{report.note}”
        </Text>
      )}
      {error && (
        <Text size="T200" style={{ color: color.Critical.Main }}>
          {error}
        </Text>
      )}
      {(report.stack || report.ua) && (
        <Box direction="Column" gap="100">
          <Button
            size="300"
            variant="Secondary"
            fill="None"
            radii="300"
            onClick={() => setOpen(!open)}
            style={{ alignSelf: 'flex-start' }}
          >
            <Text size="B300">{open ? 'Hide details' : 'Show details'}</Text>
          </Button>
          {open && (
            <Text
              as="pre"
              size="T200"
              style={{
                margin: 0,
                padding: config.space.S300,
                borderRadius: config.radii.R300,
                background: color.Background.Container,
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                fontFamily: 'monospace',
              }}
            >
              {[report.ua, report.stack].filter(Boolean).join('\n\n')}
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
}

export function AppReports() {
  const mx = useMatrixClient();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['app-reports'],
    queryFn: () => listReports(mx),
  });

  const onDone = (id: number) =>
    queryClient.setQueryData<AppReport[] | undefined>(['app-reports'], (old) =>
      old?.filter((r) => r.id !== id)
    );

  if (isLoading) {
    return (
      <Box justifyContent="Center" style={{ padding: config.space.S700 }}>
        <Spinner variant="Secondary" />
      </Box>
    );
  }
  if (isError) {
    return <Text priority="300">Couldn&apos;t load reports. The Worker may be down.</Text>;
  }
  if (!data) {
    return <Text priority="300">Only accounts with the developer badge can read app reports.</Text>;
  }

  return (
    <Box direction="Column" gap="400">
      <Box alignItems="Center" gap="300">
        <Text size="T300" priority="300" style={{ flexGrow: 1 }}>
          {data.length === 0
            ? 'No reports. Nothing has crashed, or nobody has told us yet.'
            : `${data.length} report${data.length === 1 ? '' : 's'}`}
        </Text>
        <Button
          size="300"
          variant="Secondary"
          fill="Soft"
          radii="300"
          disabled={isFetching}
          onClick={() => refetch()}
        >
          <Text size="B300">Refresh</Text>
        </Button>
      </Box>
      {data.map((report) => (
        <ReportItem key={report.id} report={report} onDone={onDone} />
      ))}
    </Box>
  );
}

type OnArchive = (id: number, archived: boolean) => void;

function BugDetail({
  report,
  onArchive,
  requestClose,
}: {
  report: BugReport;
  onArchive: OnArchive;
  requestClose: () => void;
}) {
  const mx = useMatrixClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const archived = !!report.archivedAt;

  const toggle = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await (archived ? reopenBugReport(mx, report.id) : archiveBugReport(mx, report.id));
      onArchive(report.id, !archived);
      requestClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  };

  return (
    <Modal500 requestClose={requestClose}>
      <Box direction="Column" style={{ height: '100%', minHeight: 0 }}>
        <Header
          size="500"
          style={{ padding: `0 ${config.space.S200} 0 ${config.space.S400}`, flexShrink: 0 }}
        >
          <Box grow="Yes">
            <Text size="L400" style={{ color: color.Critical.Main }}>
              {bugTypeLabel(report.type)}
            </Text>
          </Box>
          <IconButton size="300" radii="300" onClick={requestClose} aria-label="Close">
            <Icon src={Icons.Cross} />
          </IconButton>
        </Header>
        <Box grow="Yes" style={{ minHeight: 0 }}>
          <Scroll hideTrack visibility="Hover">
            <Box direction="Column" gap="400" style={{ padding: config.space.S400 }}>
              <Box direction="Column" gap="100">
                <Text size="H4" style={{ overflowWrap: 'anywhere' }}>
                  {report.title}
                </Text>
                <Text size="T200" priority="300" style={{ overflowWrap: 'anywhere' }}>
                  {new Date(report.at).toLocaleString()} · {report.build ?? 'unknown build'}
                </Text>
              </Box>
              <MarkdownText text={report.body} />
              {report.ua && (
                <Text size="T200" priority="300" style={{ overflowWrap: 'anywhere' }}>
                  {report.ua}
                </Text>
              )}
              {report.archivedAt && (
                <Text size="T200" priority="300" style={{ overflowWrap: 'anywhere' }}>
                  Archived {new Date(report.archivedAt).toLocaleString()}
                  {report.archivedBy && ` by ${report.archivedBy}`}
                </Text>
              )}
              {error && (
                <Text size="T200" style={{ color: color.Critical.Main }}>
                  {error}
                </Text>
              )}
              <Box>
                <Button
                  size="300"
                  variant={archived ? 'Secondary' : 'Success'}
                  fill="Soft"
                  radii="300"
                  disabled={busy}
                  onClick={toggle}
                >
                  <Text size="B300">{archived ? 'Reopen' : 'Done'}</Text>
                </Button>
              </Box>
            </Box>
          </Scroll>
        </Box>
      </Box>
    </Modal500>
  );
}

function BugTicket({
  report,
  isNew,
  onArchive,
}: {
  report: BugReport;
  isNew: boolean;
  onArchive: OnArchive;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Box
        as="button"
        type="button"
        direction="Column"
        gap="100"
        onClick={() => setOpen(true)}
        style={{
          padding: config.space.S300,
          borderRadius: config.radii.R400,
          background: color.SurfaceVariant.Container,
          borderLeft: `${config.borderWidth.B700} solid ${
            report.archivedAt ? color.SurfaceVariant.ContainerLine : color.Critical.Main
          }`,
          opacity: report.archivedAt ? 0.75 : 1,
          color: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
          border: 'none',
        }}
      >
        <Box alignItems="Center" gap="200">
          <Text size="T300" style={{ flexGrow: 1 }} truncate>
            <b>{report.title}</b>
          </Text>
          {isNew && (
            <Badge variant="Critical" fill="Solid" radii="Pill" size="400">
              <Text as="span" size="L400">
                New
              </Text>
            </Badge>
          )}
        </Box>
        <Text size="T200" priority="300" truncate>
          {bugTypeLabel(report.type)} · {new Date(report.at).toLocaleDateString()}
        </Text>
      </Box>
      {open && (
        <BugDetail report={report} onArchive={onArchive} requestClose={() => setOpen(false)} />
      )}
    </>
  );
}

export function UserBugReports() {
  const mx = useMatrixClient();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: BUG_REPORTS_KEY,
    queryFn: () => listBugReports(mx),
  });
  const seenBefore = useMarkBugsSeen(data);

  const onArchive: OnArchive = (id, archived) =>
    queryClient.setQueryData<BugReport[] | undefined>(BUG_REPORTS_KEY, (old) =>
      old?.map((r) =>
        r.id === id
          ? {
              ...r,
              archivedAt: archived ? Date.now() : null,
              archivedBy: archived ? mx.getSafeUserId() : null,
            }
          : r
      )
    );

  if (isLoading) {
    return (
      <Box justifyContent="Center" style={{ padding: config.space.S700 }}>
        <Spinner variant="Secondary" />
      </Box>
    );
  }
  if (isError) {
    return <Text priority="300">Couldn&apos;t load bug reports. The Worker may be down.</Text>;
  }
  if (!data) {
    return <Text priority="300">Only accounts with the developer badge can read bug reports.</Text>;
  }

  const active = data.filter((r) => !r.archivedAt);
  const fresh = active.filter((r) => r.id > seenBefore);
  const earlier = active.filter((r) => r.id <= seenBefore);
  const archived = data.filter((r) => r.archivedAt);
  const section = (title: string, reports: BugReport[], isNew: boolean) =>
    reports.length > 0 && (
      <Box direction="Column" gap="200">
        <Text size="L400">{title}</Text>
        {reports.map((report) => (
          <BugTicket key={report.id} report={report} isNew={isNew} onArchive={onArchive} />
        ))}
      </Box>
    );

  return (
    <Box direction="Column" gap="500">
      <Box alignItems="Center" gap="300">
        <Text size="T300" priority="300" style={{ flexGrow: 1 }}>
          {active.length === 0
            ? 'No open bug reports right now.'
            : `${active.length} open bug report${active.length === 1 ? '' : 's'}`}
        </Text>
        <Button
          size="300"
          variant="Secondary"
          fill="Soft"
          radii="300"
          disabled={isFetching}
          onClick={() => refetch()}
        >
          <Text size="B300">Refresh</Text>
        </Button>
      </Box>
      {section('New', fresh, true)}
      {section('Open', earlier, false)}
      {section('Archived', archived, false)}
    </Box>
  );
}
