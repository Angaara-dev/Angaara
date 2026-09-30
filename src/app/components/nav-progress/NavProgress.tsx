import React, { useContext, useEffect, useState } from 'react';
import { UNSAFE_DataRouterContext as DataRouterContext, useLocation } from 'react-router-dom';
import * as css from './NavProgress.css';

// CSS-only, so it keeps animating on the compositor while the main thread renders.
export function NavProgress() {
  const router = useContext(DataRouterContext)?.router;
  const shown = useLocation().key;
  const [target, setTarget] = useState(shown);

  useEffect(() => router?.subscribe((state) => setTarget(state.location.key)), [router]);

  return target !== shown ? (
    <div className={css.Bar} role="progressbar" aria-label="Loading" />
  ) : null;
}
