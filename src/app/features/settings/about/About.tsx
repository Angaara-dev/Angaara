import React from 'react';
import { Box, Text, Icon, Icons, Scroll, Button, config, toRem } from 'folds';
import { Page, PageContent } from '../../../components/page';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../styles.css';
import { SettingTile } from '../../../components/setting-tile';
import AngaaraSVG from '../../../../../public/res/svg/angaara.svg';
import { clearCacheAndReload } from '../../../../client/initMatrix';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import {
  BRAND_MARK,
  BRAND_NAME,
  SECURITY_URL,
  SOURCE_URL,
  SUPPORT_URL,
  TERMS_URL,
} from '../../../brand';
import { SettingsPageHeader } from '../SettingsPageHeader';

type AboutProps = {
  requestClose: () => void;
};
export function About({ requestClose }: AboutProps) {
  const mx = useMatrixClient();

  return (
    <Page>
      <SettingsPageHeader title="About" requestClose={requestClose} />
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <Box direction="Column" gap="700">
              <Box gap="400">
                <Box shrink="No">
                  <img
                    style={{ width: toRem(60), height: toRem(60) }}
                    src={AngaaraSVG}
                    alt={`${BRAND_NAME} logo`}
                  />
                </Box>
                <Box direction="Column" gap="300">
                  <Box direction="Column" gap="100">
                    <Box gap="100" alignItems="End">
                      <Text size="H3">{BRAND_MARK}</Text>
                      <Text size="T200">based on Cinny v4.12.7</Text>
                    </Box>
                    <Text>Your communities, on an open network.</Text>
                  </Box>

                  <Box gap="200" wrap="Wrap">
                    <Button
                      as="a"
                      href="https://github.com/cinnyapp/cinny"
                      rel="noreferrer noopener"
                      target="_blank"
                      variant="Secondary"
                      fill="Soft"
                      size="300"
                      radii="300"
                      before={<Icon src={Icons.Code} size="100" filled />}
                    >
                      <Text size="B300">Based on Cinny</Text>
                    </Button>
                    <Button
                      as="a"
                      href={TERMS_URL}
                      rel="noreferrer noopener"
                      target="_blank"
                      variant="Secondary"
                      fill="Soft"
                      size="300"
                      radii="300"
                      before={<Icon src={Icons.Info} size="100" filled />}
                    >
                      <Text size="B300">Terms</Text>
                    </Button>
                  </Box>
                </Box>
              </Box>
              <Box direction="Column" gap="100">
                <Text size="L400">Support</Text>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                  gap="400"
                >
                  <SettingTile
                    title={`Support ${BRAND_NAME}`}
                    description={`I'm a solo dev keeping this free for everyone. If it's useful, $2/month helps cover hosting and development.`}
                    after={
                      <Button
                        as="a"
                        href={SUPPORT_URL || undefined}
                        target="_blank"
                        rel="noreferrer noopener"
                        aria-disabled={!SUPPORT_URL}
                        onClick={(e: React.MouseEvent) => {
                          if (!SUPPORT_URL) e.preventDefault();
                        }}
                        variant="Primary"
                        fill="Soft"
                        size="300"
                        radii="300"
                        before={<Icon src={Icons.Heart} size="100" filled />}
                      >
                        <Text size="B300">Support</Text>
                      </Button>
                    }
                  />
                </SequenceCard>
              </Box>
              <Box direction="Column" gap="100">
                <Text size="L400">Contribute</Text>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                  gap="400"
                >
                  <SettingTile
                    title="Source Code"
                    description={`${BRAND_NAME} is open source. If you'd like to contribute, head over to the source code.`}
                    after={
                      <Button
                        as="a"
                        href={SOURCE_URL}
                        target="_blank"
                        rel="noreferrer noopener"
                        variant="Secondary"
                        fill="Soft"
                        size="300"
                        radii="300"
                        before={<Icon src={Icons.Code} size="100" filled />}
                      >
                        <Text size="B300">GitHub</Text>
                      </Button>
                    }
                  />
                </SequenceCard>
              </Box>
              <Box direction="Column" gap="100">
                <Text size="L400">Privacy &amp; Security</Text>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                  gap="400"
                >
                  <SettingTile
                    title="Security Center"
                    description="See how we handle your privacy and security."
                    after={
                      <Button
                        as="a"
                        href={SECURITY_URL}
                        target="_blank"
                        rel="noreferrer noopener"
                        variant="Secondary"
                        fill="Soft"
                        size="300"
                        radii="300"
                        before={<Icon src={Icons.Shield} size="100" filled />}
                      >
                        <Text size="B300">Open</Text>
                      </Button>
                    }
                  />
                </SequenceCard>
              </Box>
              <Box direction="Column" gap="100">
                <Text size="L400">Options</Text>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                  gap="400"
                >
                  <SettingTile
                    title="Clear Cache & Reload"
                    description="Clear all your locally stored data and reload from server."
                    after={
                      <Button
                        onClick={() => clearCacheAndReload(mx)}
                        variant="Secondary"
                        fill="Soft"
                        size="300"
                        radii="300"
                        outlined
                      >
                        <Text size="B300">Clear Cache</Text>
                      </Button>
                    }
                  />
                </SequenceCard>
              </Box>
              <Box direction="Column" gap="100">
                <Text size="L400">Credits</Text>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                  gap="400"
                >
                  <Box
                    as="ul"
                    direction="Column"
                    gap="200"
                    style={{
                      margin: 0,
                      paddingLeft: config.space.S400,
                    }}
                  >
                    <li>
                      <Text size="T300">
                        The{' '}
                        <a
                          href="https://github.com/matrix-org/matrix-js-sdk"
                          rel="noreferrer noopener"
                          target="_blank"
                        >
                          matrix-js-sdk
                        </a>{' '}
                        is ©{' '}
                        <a
                          href="https://matrix.org/foundation"
                          rel="noreferrer noopener"
                          target="_blank"
                        >
                          The Matrix.org Foundation C.I.C
                        </a>{' '}
                        used under the terms of{' '}
                        <a
                          href="http://www.apache.org/licenses/LICENSE-2.0"
                          rel="noreferrer noopener"
                          target="_blank"
                        >
                          Apache 2.0
                        </a>
                        .
                      </Text>
                    </li>
                    <li>
                      <Text size="T300">
                        The{' '}
                        <a
                          href="https://github.com/mozilla/twemoji-colr"
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          twemoji-colr
                        </a>{' '}
                        font is ©{' '}
                        <a href="https://mozilla.org/" target="_blank" rel="noreferrer noopener">
                          Mozilla Foundation
                        </a>{' '}
                        used under the terms of{' '}
                        <a
                          href="http://www.apache.org/licenses/LICENSE-2.0"
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          Apache 2.0
                        </a>
                        .
                      </Text>
                    </li>
                    <li>
                      <Text size="T300">
                        The{' '}
                        <a
                          href="https://twemoji.twitter.com"
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          Twemoji
                        </a>{' '}
                        emoji art is ©{' '}
                        <a
                          href="https://twemoji.twitter.com"
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          Twitter, Inc and other contributors
                        </a>{' '}
                        used under the terms of{' '}
                        <a
                          href="https://creativecommons.org/licenses/by/4.0/"
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          CC-BY 4.0
                        </a>
                        .
                      </Text>
                    </li>
                    <li>
                      <Text size="T300">
                        The{' '}
                        <a
                          href="https://material.io/design/sound/sound-resources.html"
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          Material sound resources
                        </a>{' '}
                        are ©{' '}
                        <a href="https://google.com" target="_blank" rel="noreferrer noopener">
                          Google
                        </a>{' '}
                        used under the terms of{' '}
                        <a
                          href="https://creativecommons.org/licenses/by/4.0/"
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          CC-BY 4.0
                        </a>
                        .
                      </Text>
                    </li>
                  </Box>
                </SequenceCard>
              </Box>
            </Box>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
