import React, { MouseEventHandler, Suspense, lazy, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom, useSetAtom } from 'jotai';
import { useFocusWithin, useHover } from 'react-aria';
import FocusTrap from 'focus-trap-react';
import {
  Avatar,
  Box,
  Icon,
  IconButton,
  Icons,
  Menu,
  MenuItem,
  PopOut,
  RectCords,
  Text,
  config,
  toRem,
} from 'folds';
import { NavButton, NavItem, NavItemContent, NavItemOptions } from '../../../components/nav';
import { getHomeDeveloperPath } from '../../pathUtils';
import { useHomeDeveloperSelected } from '../../../hooks/router/useHomeSelected';
import { stopPropagation } from '../../../utils/keyboard';
import {
  activeProjectIdAtom,
  ProjectMeta,
  projectDialogAtom,
  useProjectIndex,
} from '../../../features/developer-portal/projects';

const ProjectDialogs = lazy(() => import('../../../features/developer-portal/ProjectDialogs'));

function ProjectNavItem({ project }: { project: ProjectMeta }) {
  const navigate = useNavigate();
  const buildSelected = useHomeDeveloperSelected('build');
  const [activeId, setActiveId] = useAtom(activeProjectIdAtom);
  const setDialog = useSetAtom(projectDialogAtom);
  const [hover, setHover] = useState(false);
  const { hoverProps } = useHover({ onHoverChange: setHover });
  const { focusWithinProps } = useFocusWithin({ onFocusWithinChange: setHover });
  const [menuAnchor, setMenuAnchor] = useState<RectCords>();
  const selected = buildSelected && activeId === project.id;

  const handleContextMenu: MouseEventHandler<HTMLElement> = (evt) => {
    evt.preventDefault();
    setMenuAnchor({ x: evt.clientX, y: evt.clientY, width: 0, height: 0 });
  };
  const openDialog = (kind: 'rename' | 'delete') => {
    setMenuAnchor(undefined);
    setDialog({ kind, project });
  };

  return (
    <NavItem
      variant="Background"
      radii="400"
      aria-selected={selected}
      data-hover={!!menuAnchor}
      onContextMenu={handleContextMenu}
      {...hoverProps}
      {...focusWithinProps}
    >
      <NavButton
        onClick={() => {
          setActiveId(project.id);
          navigate(getHomeDeveloperPath('build'));
        }}
      >
        <NavItemContent>
          <Box as="span" grow="Yes" alignItems="Center" gap="200">
            <Avatar size="200" radii="400">
              <Icon src={Icons.Category} size="100" filled={selected} />
            </Avatar>
            <Box as="span" grow="Yes">
              <Text as="span" size="Inherit" truncate>
                {project.name}
              </Text>
            </Box>
            {project.encrypted && !hover && !menuAnchor && (
              <Icon size="50" src={Icons.Lock} aria-label="Encrypted" />
            )}
          </Box>
        </NavItemContent>
      </NavButton>
      {(hover || !!menuAnchor) && (
        <NavItemOptions>
          <PopOut
            id={`project-menu-${project.id}`}
            anchor={menuAnchor}
            offset={menuAnchor?.width === 0 ? 0 : undefined}
            alignOffset={menuAnchor?.width === 0 ? 0 : -5}
            position="Bottom"
            align={menuAnchor?.width === 0 ? 'Start' : 'End'}
            content={
              <FocusTrap
                focusTrapOptions={{
                  initialFocus: false,
                  returnFocusOnDeactivate: false,
                  onDeactivate: () => setMenuAnchor(undefined),
                  clickOutsideDeactivates: true,
                  isKeyForward: (evt: KeyboardEvent) => evt.key === 'ArrowDown',
                  isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp',
                  escapeDeactivates: stopPropagation,
                }}
              >
                <Menu style={{ maxWidth: toRem(160), width: '100vw' }}>
                  <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
                    <MenuItem
                      size="300"
                      radii="300"
                      onClick={() => openDialog('rename')}
                      after={<Icon size="100" src={Icons.Pencil} />}
                    >
                      <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
                        Rename
                      </Text>
                    </MenuItem>
                    <MenuItem
                      size="300"
                      radii="300"
                      variant="Critical"
                      fill="None"
                      onClick={() => openDialog('delete')}
                      after={<Icon size="100" src={Icons.Delete} />}
                    >
                      <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
                        Delete
                      </Text>
                    </MenuItem>
                  </Box>
                </Menu>
              </FocusTrap>
            }
          >
            <IconButton
              onClick={(evt: React.MouseEvent<HTMLButtonElement>) =>
                setMenuAnchor(evt.currentTarget.getBoundingClientRect())
              }
              aria-pressed={!!menuAnchor}
              aria-controls={`project-menu-${project.id}`}
              aria-label="Project Options"
              variant="Background"
              fill="None"
              size="300"
              radii="300"
            >
              <Icon size="50" src={Icons.VerticalDots} />
            </IconButton>
          </PopOut>
        </NavItemOptions>
      )}
    </NavItem>
  );
}

export function ProjectNav({ open }: { open: boolean }) {
  const { projects } = useProjectIndex();
  const [dialog, setDialog] = useAtom(projectDialogAtom);

  return (
    <>
      {open && projects.map((project) => <ProjectNavItem key={project.id} project={project} />)}
      {open && (
        <NavItem variant="Background" radii="400">
          <NavButton onClick={() => setDialog({ kind: 'new' })}>
            <NavItemContent>
              <Box as="span" grow="Yes" alignItems="Center" gap="200">
                <Avatar size="200" radii="400">
                  <Icon src={Icons.Plus} size="100" />
                </Avatar>
                <Box as="span" grow="Yes">
                  <Text as="span" size="Inherit" truncate>
                    New Project
                  </Text>
                </Box>
              </Box>
            </NavItemContent>
          </NavButton>
        </NavItem>
      )}
      {dialog && (
        <Suspense fallback={null}>
          <ProjectDialogs />
        </Suspense>
      )}
    </>
  );
}
