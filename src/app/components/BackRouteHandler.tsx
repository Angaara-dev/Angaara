import { ReactNode, useCallback } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import {
  getDirectPath,
  getExplorePath,
  getHomePath,
  getInboxPath,
  getSpacePath,
} from '../pages/pathUtils';
import { DIRECT_PATH, EXPLORE_PATH, HOME_PATH, INBOX_PATH, SPACE_PATH } from '../pages/paths';

type BackRouteHandlerProps = {
  children: (onBack: () => void) => ReactNode;
};
export function useBackRoute() {
  const navigate = useNavigate();
  const location = useLocation();

  const goBack = useCallback(
    (replace?: unknown) => {
      const opts = { replace: replace === true };
      if (
        matchPath(
          {
            path: HOME_PATH,
            caseSensitive: true,
            end: false,
          },
          location.pathname
        )
      ) {
        navigate(getHomePath(), opts);
        return;
      }
      if (
        matchPath(
          {
            path: DIRECT_PATH,
            caseSensitive: true,
            end: false,
          },
          location.pathname
        )
      ) {
        navigate(getDirectPath(), opts);
        return;
      }
      const spaceMatch = matchPath(
        {
          path: SPACE_PATH,
          caseSensitive: true,
          end: false,
        },
        location.pathname
      );
      const encodedSpaceIdOrAlias = spaceMatch?.params.spaceIdOrAlias;
      const decodedSpaceIdOrAlias =
        encodedSpaceIdOrAlias && decodeURIComponent(encodedSpaceIdOrAlias);

      if (decodedSpaceIdOrAlias) {
        navigate(getSpacePath(decodedSpaceIdOrAlias), opts);
        return;
      }
      if (
        matchPath(
          {
            path: EXPLORE_PATH,
            caseSensitive: true,
            end: false,
          },
          location.pathname
        )
      ) {
        navigate(getExplorePath(), opts);
        return;
      }
      if (
        matchPath(
          {
            path: INBOX_PATH,
            caseSensitive: true,
            end: false,
          },
          location.pathname
        )
      ) {
        navigate(getInboxPath(), opts);
      }
    },
    [navigate, location]
  );

  return goBack;
}

export function BackRouteHandler({ children }: BackRouteHandlerProps) {
  return children(useBackRoute());
}
