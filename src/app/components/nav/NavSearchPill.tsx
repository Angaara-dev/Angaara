import React from 'react';
import { Link } from 'react-router-dom';
import { Icon, Icons, Text } from 'folds';
import * as css from './styles.css';

export function NavSearchPill({ to, selected }: { to: string; selected: boolean }) {
  return (
    <Link to={to} className={css.NavSearchPill} aria-current={selected ? 'page' : undefined}>
      <Icon src={Icons.Search} size="100" />
      <Text as="span" size="T300">
        Search
      </Text>
    </Link>
  );
}
