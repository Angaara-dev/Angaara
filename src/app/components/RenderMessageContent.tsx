import React from 'react';
import { MsgType } from 'matrix-js-sdk';
import { HTMLReactParserOptions } from 'html-react-parser';
import { Opts } from 'linkifyjs';
import { config } from 'folds';
import {
  AudioContent,
  DownloadFile,
  FileContent,
  ImageContent,
  MAudio,
  MBadEncrypted,
  MEmote,
  MFile,
  MImage,
  MLocation,
  MNotice,
  MText,
  MVideo,
  ReadPdfFile,
  ReadTextFile,
  RenderBody,
  ThumbnailContent,
  UnsupportedContent,
  VideoContent,
  AngaaraEmbed,
  embedLeadText,
  parseEmbed,
} from './message';
import { UrlPreviewCard, UrlPreviewHolder } from './url-preview';
import { Image, MediaControl, Video } from './media';
import { ImageViewer } from './image-viewer';
import { PdfViewer } from './Pdf-viewer';
import { TextViewer } from './text-viewer';
import { testMatrixTo } from '../plugins/matrix-to';
import { IImageContent } from '../../types/matrix/common';
import { Sha256Message } from './message/Sha256Message';
import { SHA256_MESSAGE_KEY } from '../utils/sha256';

type RenderMessageContentProps = {
  displayName: string;
  msgType: string;
  ts: number;
  edited?: boolean;
  getContent: <T>() => T;
  mediaAutoLoad?: boolean;
  urlPreview?: boolean;
  highlightRegex?: RegExp;
  htmlReactParserOptions: HTMLReactParserOptions;
  linkifyOpts: Opts;
  outlineAttachment?: boolean;
};
export function RenderMessageContent({
  displayName,
  msgType,
  ts,
  edited,
  getContent,
  mediaAutoLoad,
  urlPreview,
  highlightRegex,
  htmlReactParserOptions,
  linkifyOpts,
  outlineAttachment,
}: RenderMessageContentProps) {
  const renderUrlsPreview = (urls: string[]) => {
    const filteredUrls = urls.filter((url) => !testMatrixTo(url));
    if (filteredUrls.length === 0) return undefined;
    return (
      <UrlPreviewHolder>
        {filteredUrls.map((url) => (
          <UrlPreviewCard key={url} url={url} ts={ts} />
        ))}
      </UrlPreviewHolder>
    );
  };
  const renderCaption = () => {
    const content: IImageContent = getContent();
    if (content.filename && content.filename !== content.body) {
      return (
        <MText
          style={{ marginTop: config.space.S200 }}
          edited={edited}
          content={content}
          renderBody={(props) => (
            <RenderBody
              {...props}
              highlightRegex={highlightRegex}
              htmlReactParserOptions={htmlReactParserOptions}
              linkifyOpts={linkifyOpts}
            />
          )}
          renderUrlsPreview={urlPreview ? renderUrlsPreview : undefined}
        />
      );
    }
    return null;
  };

  const renderFile = () => (
    <>
      <MFile
        content={getContent()}
        renderFileContent={({ body, mimeType, info, encInfo, url }) => (
          <FileContent
            body={body}
            mimeType={mimeType}
            renderAsPdfFile={() => (
              <ReadPdfFile
                body={body}
                mimeType={mimeType}
                url={url}
                encInfo={encInfo}
                renderViewer={(p) => <PdfViewer {...p} />}
              />
            )}
            renderAsTextFile={() => (
              <ReadTextFile
                body={body}
                mimeType={mimeType}
                url={url}
                encInfo={encInfo}
                renderViewer={(p) => <TextViewer {...p} />}
              />
            )}
          >
            <DownloadFile body={body} mimeType={mimeType} url={url} encInfo={encInfo} info={info} />
          </FileContent>
        )}
        outlined={outlineAttachment}
      />
      {renderCaption()}
    </>
  );

  // Bot embeds replace their text fallback; any lead text still renders above the card.
  const renderWithEmbed = (render: (content: Record<string, unknown>) => JSX.Element) => {
    const content = getContent<Record<string, unknown>>();
    const embed = parseEmbed(content);
    if (!embed || typeof content.body !== 'string') return render(content);
    const lead = embedLeadText(content.body, embed);
    return (
      <>
        {lead && render({ msgtype: content.msgtype, body: lead })}
        <AngaaraEmbed embed={embed} linkifyOpts={linkifyOpts} />
      </>
    );
  };

  if (msgType === MsgType.Text) {
    const textContent = getContent<Record<string, unknown>>();
    const { body } = textContent;
    if (
      textContent[SHA256_MESSAGE_KEY] === true &&
      typeof body === 'string' &&
      /^[0-9a-f]{64}$/.test(body)
    ) {
      return <Sha256Message hash={body} />;
    }
    return renderWithEmbed((content) => (
      <MText
        edited={edited}
        content={content}
        renderBody={(props) => (
          <RenderBody
            {...props}
            highlightRegex={highlightRegex}
            htmlReactParserOptions={htmlReactParserOptions}
            linkifyOpts={linkifyOpts}
          />
        )}
        renderUrlsPreview={urlPreview ? renderUrlsPreview : undefined}
      />
    ));
  }

  if (msgType === MsgType.Emote) {
    return (
      <MEmote
        displayName={displayName}
        edited={edited}
        content={getContent()}
        renderBody={(props) => (
          <RenderBody
            {...props}
            highlightRegex={highlightRegex}
            htmlReactParserOptions={htmlReactParserOptions}
            linkifyOpts={linkifyOpts}
          />
        )}
        renderUrlsPreview={urlPreview ? renderUrlsPreview : undefined}
      />
    );
  }

  if (msgType === MsgType.Notice) {
    return renderWithEmbed((content) => (
      <MNotice
        edited={edited}
        content={content}
        renderBody={(props) => (
          <RenderBody
            {...props}
            highlightRegex={highlightRegex}
            htmlReactParserOptions={htmlReactParserOptions}
            linkifyOpts={linkifyOpts}
          />
        )}
        renderUrlsPreview={urlPreview ? renderUrlsPreview : undefined}
      />
    ));
  }

  if (msgType === MsgType.Image) {
    return (
      <>
        <MImage
          content={getContent()}
          renderImageContent={(props) => (
            <ImageContent
              {...props}
              autoPlay={mediaAutoLoad}
              renderImage={(p) => <Image {...p} loading="lazy" />}
              renderViewer={(p) => <ImageViewer {...p} />}
            />
          )}
          outlined={outlineAttachment}
        />
        {renderCaption()}
      </>
    );
  }

  if (msgType === MsgType.Video) {
    return (
      <>
        <MVideo
          content={getContent()}
          renderAsFile={renderFile}
          renderVideoContent={({ body, info, ...props }) => (
            <VideoContent
              body={body}
              info={info}
              {...props}
              renderThumbnail={
                mediaAutoLoad
                  ? () => (
                      <ThumbnailContent
                        info={info}
                        renderImage={(src) => (
                          <Image alt={body} title={body} src={src} loading="lazy" />
                        )}
                      />
                    )
                  : undefined
              }
              renderVideo={(p) => <Video {...p} />}
            />
          )}
          outlined={outlineAttachment}
        />
        {renderCaption()}
      </>
    );
  }

  if (msgType === MsgType.Audio) {
    return (
      <>
        <MAudio
          content={getContent()}
          renderAsFile={renderFile}
          renderAudioContent={(props) => (
            <AudioContent {...props} renderMediaControl={(p) => <MediaControl {...p} />} />
          )}
          outlined={outlineAttachment}
        />
        {renderCaption()}
      </>
    );
  }

  if (msgType === MsgType.File) {
    return renderFile();
  }

  if (msgType === MsgType.Location) {
    return <MLocation content={getContent()} />;
  }

  if (msgType === 'm.bad.encrypted') {
    return <MBadEncrypted />;
  }

  return <UnsupportedContent />;
}
