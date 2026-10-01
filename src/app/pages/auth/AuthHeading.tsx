import React from 'react';
import { Box, Text } from 'folds';
import * as css from './styles.css';

type AuthHeadingProps = {
  title: string;
  subtitle?: string;
};
export function AuthHeading({ title, subtitle }: AuthHeadingProps) {
  return (
    <Box direction="Column" alignItems="Center" gap="100">
      <Text as="h2" className={css.AuthHeadingTitle}>
        {title}
      </Text>
      {subtitle && (
        <Text size="T300" priority="300" align="Center">
          {subtitle}
        </Text>
      )}
    </Box>
  );
}
