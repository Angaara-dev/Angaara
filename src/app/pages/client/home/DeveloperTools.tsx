import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Box, Icon, Icons, Text, Scroll, IconButton } from 'folds';
import { Page, PageContent, PageContentCenter, PageHeader } from '../../../components/page';
import { ScreenSize, useScreenSizeContext } from '../../../hooks/useScreenSize';
import { BackRouteHandler } from '../../../components/BackRouteHandler';
import { DeveloperBot, DeveloperBuild } from '../../../features/developer-portal/DeveloperPortal';
import { DeveloperDocs } from '../../../features/developer-portal/DeveloperDocs';
import { DeveloperRepos } from '../../../features/developer-portal/github/GitHubPanels';
import { DeveloperSection } from '../../paths';
import { AppReports } from '../../../features/app-reports/AppReports';
import { getHomeDeveloperPath } from '../../pathUtils';
import { DEVELOPER_PAGES } from './developerPages';
import { useDevProjectLoader } from '../../../features/developer-portal/useDevProjects';
import { ProjectGate } from '../../../features/developer-portal/ProjectGate';

export function HomeDeveloperTools() {
  const screenSize = useScreenSizeContext();
  const { section } = useParams();
  useDevProjectLoader();
  if (!section || !(section in DEVELOPER_PAGES)) {
    return <Navigate to={getHomeDeveloperPath('bot')} replace />;
  }
  const current = section as DeveloperSection;
  const page = DEVELOPER_PAGES[current];

  return (
    <Page>
      <PageHeader balance>
        <Box grow="Yes" alignItems="Center" gap="200">
          <Box grow="Yes" basis="No">
            {screenSize === ScreenSize.Mobile && (
              <BackRouteHandler>
                {(onBack) => (
                  <IconButton onClick={onBack}>
                    <Icon src={Icons.ArrowLeft} />
                  </IconButton>
                )}
              </BackRouteHandler>
            )}
          </Box>
          <Box justifyContent="Center" alignItems="Center" gap="200">
            {screenSize !== ScreenSize.Mobile && <Icon size="400" src={page.icon} />}
            <Text size="H3" truncate>
              {page.title}
            </Text>
          </Box>
          <Box grow="Yes" basis="No" />
        </Box>
      </PageHeader>
      <Box style={{ position: 'relative' }} grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <PageContentCenter>
              {current === 'bot' && <DeveloperBot />}
              {current === 'build' && (
                <ProjectGate>
                  <DeveloperBuild />
                </ProjectGate>
              )}
              {current === 'repos' && (
                <ProjectGate>
                  <DeveloperRepos />
                </ProjectGate>
              )}
              {current === 'docs' && <DeveloperDocs />}
              {current === 'reports' && <AppReports />}
            </PageContentCenter>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
