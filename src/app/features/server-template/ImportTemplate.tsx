import React, { FormEventHandler, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import {
  Box,
  Button,
  color,
  config,
  Dialog,
  Header,
  Icon,
  IconButton,
  Icons,
  Input,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Scroll,
  Spinner,
  Switch,
  Text,
  toRem,
} from 'folds';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { stopPropagation } from '../../utils/keyboard';
import { SettingTile } from '../../components/setting-tile';
import { SequenceCard } from '../../components/sequence-card';
import {
  fetchTemplate,
  ImportPlan,
  ImportProgress,
  planImport,
  runImport,
  templateCode,
} from './template';

function PlanPreview({ plan }: { plan: ImportPlan }) {
  const roles = Object.entries(plan.tags)
    .map(([level, tag]) => ({ level: Number(level), ...tag }))
    .filter((t) => t.level > 0)
    .sort((a, b) => b.level - a.level);
  return (
    <SequenceCard
      variant="SurfaceVariant"
      direction="Column"
      gap="300"
      style={{ padding: config.space.S300 }}
    >
      <Box direction="Column">
        <Text size="H5" truncate>
          {plan.name}
        </Text>
        <Text size="T200" priority="300">
          {plan.channelCount} channels · {plan.categories.filter((c) => c.name).length} categories ·{' '}
          {roles.length} roles
        </Text>
      </Box>
      <Box direction="Column" gap="200" style={{ maxHeight: toRem(180), overflowY: 'auto' }}>
        {plan.categories.map((category, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <Box key={i} direction="Column">
            {category.name && (
              <Text size="L400" priority="300" truncate>
                {category.name.toUpperCase()}
              </Text>
            )}
            {category.channels.map((channel, j) => (
              // eslint-disable-next-line react/no-array-index-key
              <Box key={j} alignItems="Center" gap="100">
                <Icon
                  size="50"
                  src={
                    // eslint-disable-next-line no-nested-ternary
                    channel.kind === 'voice'
                      ? Icons.VolumeHigh
                      : channel.private
                      ? Icons.HashLock
                      : Icons.Hash
                  }
                />
                <Text size="T200" truncate>
                  {channel.name}
                </Text>
              </Box>
            ))}
          </Box>
        ))}
      </Box>
      {roles.length > 0 && (
        <Box wrap="Wrap" gap="100">
          {roles.map((role) => (
            <Text
              key={role.level}
              size="T200"
              style={{
                color: role.color,
                border: `${config.borderWidth.B300} solid ${color.SurfaceVariant.ContainerLine}`,
                borderRadius: config.radii.R300,
                padding: `0 ${config.space.S100}`,
              }}
            >
              {role.name}
            </Text>
          ))}
        </Box>
      )}
      {plan.droppedRoles > 0 && (
        <Text size="T200" priority="300">
          {plan.droppedRoles} more roles are left out, since there aren&apos;t enough role levels.
        </Text>
      )}
    </SequenceCard>
  );
}

type ImportTemplateProps = {
  onCancel: () => void;
  onDone: (spaceId: string) => void;
};
export function ImportTemplate({ onCancel, onDone }: ImportTemplateProps) {
  const mx = useMatrixClient();
  const [plan, setPlan] = useState<ImportPlan>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [encryptAll, setEncryptAll] = useState(false);
  const [progress, setProgress] = useState<ImportProgress>();
  const importing = !!progress;

  const handleLookup: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    const input = (evt.currentTarget.templateInput as HTMLInputElement | undefined)?.value ?? '';
    const code = templateCode(input);
    if (!code) {
      setError("That doesn't look like a template link.");
      return;
    }
    setError(undefined);
    setPlan(undefined);
    setLoading(true);
    fetchTemplate(code)
      .then((template) => setPlan(planImport(template)))
      .catch((e) => setError(e instanceof Error ? e.message : "The template couldn't be loaded."))
      .finally(() => setLoading(false));
  };

  const handleImport = () => {
    if (!plan) return;
    setError(undefined);
    setProgress({ done: 0, total: 1, step: 'Starting' });
    runImport(mx, plan, encryptAll, setProgress)
      .then(onDone)
      .catch((e) => {
        setProgress(undefined);
        setError(
          `The import stopped: ${e instanceof Error ? e.message : 'unknown error'}. ` +
            'Anything already made stays, so you can finish it by hand or delete it.'
        );
      });
  };

  const close = () => {
    if (!importing) onCancel();
  };

  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            onDeactivate: close,
            clickOutsideDeactivates: !importing,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Dialog variant="Surface">
            <Header
              style={{ padding: `0 ${config.space.S200} 0 ${config.space.S400}` }}
              variant="Surface"
              size="500"
            >
              <Box grow="Yes">
                <Text size="H4">Import a Server Template</Text>
              </Box>
              <IconButton size="300" onClick={close} radii="300" disabled={importing}>
                <Icon src={Icons.Cross} />
              </IconButton>
            </Header>
            <Scroll size="300" hideTrack style={{ maxHeight: '75vh' }}>
              <Box
                direction="Column"
                gap="400"
                style={{ padding: config.space.S400, paddingTop: 0 }}
              >
                <Text priority="400" size="T300">
                  Paste a server template link and Angaara builds a new space with the same
                  channels, categories and roles. Messages and members aren&apos;t part of a
                  template.
                </Text>
                <Box as="form" onSubmit={handleLookup} gap="200">
                  <Input
                    size="400"
                    autoFocus
                    name="templateInput"
                    variant="Background"
                    placeholder="Template link or code"
                    required
                    disabled={loading || importing}
                    style={{ flexGrow: 1 }}
                  />
                  <Button
                    type="submit"
                    size="400"
                    variant="Secondary"
                    fill="Soft"
                    disabled={loading || importing}
                    before={loading && <Spinner size="100" variant="Secondary" />}
                  >
                    <Text size="B400">Look Up</Text>
                  </Button>
                </Box>
                {plan && <PlanPreview plan={plan} />}
                {plan && (
                  <SettingTile
                    title="Encrypt every channel"
                    description="Private channels are always encrypted. Encrypting the rest means new members can't read messages from before they joined."
                    after={
                      <Switch
                        variant="Primary"
                        value={encryptAll}
                        onChange={setEncryptAll}
                        disabled={importing}
                      />
                    }
                  />
                )}
                {error && (
                  <Text size="T200" style={{ color: color.Critical.Main }}>
                    {error}
                  </Text>
                )}
                {progress && (
                  <Box direction="Column" gap="100">
                    <Box
                      style={{
                        height: toRem(6),
                        borderRadius: config.radii.Pill,
                        background: color.SurfaceVariant.Container,
                        overflow: 'hidden',
                      }}
                    >
                      <Box
                        style={{
                          width: `${Math.round((progress.done / progress.total) * 100)}%`,
                          background: color.Primary.Main,
                          transition: 'width 300ms',
                        }}
                      />
                    </Box>
                    <Text size="T200" priority="300" truncate>
                      {progress.waitMs
                        ? `Your server asked us to slow down. Continuing in ${Math.ceil(
                            progress.waitMs / 1000
                          )}s…`
                        : `${progress.step} (${progress.done} of ${progress.total})`}
                    </Text>
                    <Text size="T200" priority="300">
                      Keep this open until it&apos;s done.
                    </Text>
                  </Box>
                )}
                {plan && (
                  <Button
                    variant="Primary"
                    onClick={handleImport}
                    disabled={importing}
                    before={importing && <Spinner size="100" variant="Primary" fill="Solid" />}
                  >
                    <Text size="B400">{importing ? 'Importing' : 'Create Space'}</Text>
                  </Button>
                )}
              </Box>
            </Scroll>
          </Dialog>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}
