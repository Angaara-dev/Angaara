import { useMatch } from 'react-router-dom';
import { getDirectCreatePath, getDirectFriendsPath, getDirectPath } from '../../pages/pathUtils';

export const useDirectSelected = (): boolean => {
  const directMatch = useMatch({
    path: getDirectPath(),
    caseSensitive: true,
    end: false,
  });

  return !!directMatch;
};

export const useDirectCreateSelected = (): boolean => {
  const match = useMatch({
    path: getDirectCreatePath(),
    caseSensitive: true,
    end: false,
  });

  return !!match;
};

export const useDirectFriendsSelected = (): boolean =>
  !!useMatch({ path: getDirectFriendsPath(), caseSensitive: true, end: false });
