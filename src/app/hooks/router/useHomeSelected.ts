import { useMatch } from 'react-router-dom';
import {
  getHomeCreatePath,
  getHomeJoinPath,
  getHomePath,
  getHomeSearchPath,
  getHomeDeveloperPath,
} from '../../pages/pathUtils';
import { DeveloperSection } from '../../pages/paths';

export const useHomeSelected = (): boolean => {
  const homeMatch = useMatch({
    path: getHomePath(),
    caseSensitive: true,
    end: false,
  });

  return !!homeMatch;
};

export const useHomeCreateSelected = (): boolean => {
  const match = useMatch({
    path: getHomeCreatePath(),
    caseSensitive: true,
    end: false,
  });

  return !!match;
};

export const useHomeJoinSelected = (): boolean => {
  const match = useMatch({
    path: getHomeJoinPath(),
    caseSensitive: true,
    end: false,
  });

  return !!match;
};

export const useHomeSearchSelected = (): boolean => {
  const match = useMatch({
    path: getHomeSearchPath(),
    caseSensitive: true,
    end: false,
  });

  return !!match;
};

export const useHomeDeveloperSelected = (section: DeveloperSection): boolean => {
  const match = useMatch({
    path: getHomeDeveloperPath(section),
    caseSensitive: true,
    end: false,
  });

  return !!match;
};
