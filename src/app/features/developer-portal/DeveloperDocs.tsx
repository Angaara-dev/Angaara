import React, { useMemo } from 'react';
import { Box, Chip, Text, color, config } from 'folds';
import { SequenceCard } from '../../components/sequence-card';
import { SequenceCardStyle } from '../settings/styles.css';
import { CodeBlock, CopyChip } from './CodeBlock';
import { DOC_SECTIONS, DocBlock, DocSection, docsToMarkdown } from './docs';

function DocBlockView({ block }: { block: DocBlock }) {
  if (block.kind === 'text') {
    return <Text size="T300">{block.text}</Text>;
  }
  if (block.kind === 'list') {
    return (
      <Box
        as="ul"
        direction="Column"
        gap="100"
        style={{ margin: 0, paddingLeft: config.space.S500 }}
      >
        {block.items.map((item) => (
          <Text as="li" size="T300" key={item}>
            {item}
          </Text>
        ))}
      </Box>
    );
  }
  return <CodeBlock code={block.code} file={block.file} />;
}

function DocSectionView({ section }: { section: DocSection }) {
  return (
    <SequenceCard
      className={SequenceCardStyle}
      variant="SurfaceVariant"
      direction="Column"
      gap="300"
      id={`docs-${section.id}`}
    >
      <Text size="H5">{section.title}</Text>
      {section.blocks.map((block, index) => (
        // eslint-disable-next-line react/no-array-index-key
        <DocBlockView key={index} block={block} />
      ))}
    </SequenceCard>
  );
}

export function DeveloperDocs() {
  const markdown = useMemo(() => docsToMarkdown(DOC_SECTIONS), []);
  const jumpTo = (id: string) =>
    document.getElementById(`docs-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <Box direction="Column" gap="200">
      <Box gap="100" wrap="Wrap">
        {DOC_SECTIONS.map((section) => (
          <Chip
            key={section.id}
            variant="SurfaceVariant"
            radii="Pill"
            onClick={() => jumpTo(section.id)}
          >
            <Text size="B300">{section.title}</Text>
          </Chip>
        ))}
      </Box>
      <Box
        direction="Column"
        gap="200"
        style={{
          padding: config.space.S400,
          borderRadius: config.radii.R400,
          background: `color-mix(in srgb, ${color.Primary.Main} 14%, ${color.SurfaceVariant.Container})`,
          border: `1px solid color-mix(in srgb, ${color.Primary.Main} 40%, transparent)`,
        }}
      >
        <Text size="H5">Vibe coding or just lazy?</Text>
        <Text size="T300">
          Copy the whole doc and paste it into your LLM atp. It has everything: setup, the starter
          template and every API.
        </Text>
        <Box>
          <CopyChip value={markdown} label="Copy All Docs" />
        </Box>
      </Box>
      {DOC_SECTIONS.map((section) => (
        <DocSectionView key={section.id} section={section} />
      ))}
    </Box>
  );
}
