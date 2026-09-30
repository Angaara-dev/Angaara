import React, { useContext, useEffect, useState } from 'react';
import { UNSAFE_DataRouterContext as DataRouterContext, useLocation } from 'react-router-dom';
import * as css from './NavProgress.css';

// Pages render in a transition, so the old one stays up meanwhile; this shows the new one is coming.
// Only CSS animates it, which keeps running on the compositor while the page itself is busy.
export function NavProgress() {
  const router = useContext(DataRouterContext)?.router;
  const shown = useLocation().key;
  const [target, setTarget] = useState(shown);

  useEffect(() => router?.subscribe((state) => setTarget(state.location.key)), [router]);

  return target !== shown ? (
    <div className={css.Bar} role="progressbar" aria-label="Loading" />
  ) : null;
}
