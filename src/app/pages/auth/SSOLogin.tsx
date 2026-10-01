import { Avatar, AvatarImage, Box, Button, Text } from 'folds';
import { IIdentityProvider, SSOAction, createClient } from 'matrix-js-sdk';
import React, { useMemo } from 'react';
import { useAutoDiscoveryInfo } from '../../hooks/useAutoDiscoveryInfo';
import { markSignupStarted } from '../../utils/newAccount';

type SSOLoginProps = {
  providers?: IIdentityProvider[];
  redirectUrl: string;
  action?: SSOAction;
  saveScreenSpace?: boolean;
};
export function SSOLogin({ providers, redirectUrl, action, saveScreenSpace }: SSOLoginProps) {
  const discovery = useAutoDiscoveryInfo();
  const baseUrl = discovery['m.homeserver'].base_url;
  const mx = useMemo(() => createClient({ baseUrl }), [baseUrl]);

  const getSSOIdUrl = (ssoId?: string): string =>
    mx.getSsoLoginUrl(redirectUrl, 'sso', ssoId, action);
  // Signing up finishes elsewhere and returns as a login, so note it for the welcome panel.
  const onStart = action === SSOAction.REGISTER ? markSignupStarted : undefined;

  const withoutIcon = providers
    ? providers.find(
        (provider) => !provider.icon || !mx.mxcUrlToHttp(provider.icon, 96, 96, 'crop', false)
      )
    : true;

  const renderAsIcons = withoutIcon ? false : saveScreenSpace && providers && providers.length > 2;

  return (
    <Box justifyContent="Center" gap="600" wrap="Wrap">
      {providers ? (
        providers.map((provider) => {
          const { id, name, icon } = provider;
          const iconUrl = icon && mx.mxcUrlToHttp(icon, 96, 96, 'crop', false);

          const buttonTitle = `Continue with ${name}`;

          if (renderAsIcons) {
            return (
              <Avatar
                style={{ cursor: 'pointer' }}
                key={id}
                as="a"
                href={getSSOIdUrl(id)}
                onClick={onStart}
                aria-label={buttonTitle}
                size="300"
                radii="300"
              >
                <AvatarImage src={iconUrl!} alt={name} title={buttonTitle} />
              </Avatar>
            );
          }

          return (
            <Button
              style={{ width: '100%' }}
              key={id}
              as="a"
              href={getSSOIdUrl(id)}
              onClick={onStart}
              size="500"
              variant="Secondary"
              fill="Soft"
              outlined
              before={
                iconUrl && (
                  <Avatar size="200" radii="300">
                    <AvatarImage src={iconUrl} alt={name} />
                  </Avatar>
                )
              }
            >
              <Text align="Center" size="B500" truncate>
                {buttonTitle}
              </Text>
            </Button>
          );
        })
      ) : (
        <Button
          style={{ width: '100%' }}
          as="a"
          href={getSSOIdUrl()}
          onClick={onStart}
          size="500"
          variant="Secondary"
          fill="Soft"
          outlined
        >
          <Text align="Center" size="B500" truncate>
            Continue with SSO
          </Text>
        </Button>
      )}
    </Box>
  );
}
