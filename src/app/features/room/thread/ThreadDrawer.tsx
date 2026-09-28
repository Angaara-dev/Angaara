import React, {
  MouseEventHandler,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { EventType, IContent, MatrixEvent, MatrixEventEvent, Room } from 'matrix-js-sdk';
import { HTMLReactParserOptions } from 'html-react-parser';
import { Opts as LinkifyOpts } from 'linkifyjs';
import classNames from 'classnames';
import { ReactEditor } from 'slate-react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  Box,
  Button,
  Header,
  Icon,
  IconButton,
  Icons,
  Line,
  Scroll,
  Spinner,
  Text,
  Tooltip,
  TooltipProvider,
  config,
} from 'folds';
import * as css from './ThreadDrawer.css';
import { useThread } from './useThread';
import { Message, Reactions, EncryptedContent } from '../message';
import { RoomInput } from '../RoomInput';
import { Reply, RedactedContent, MSticker, ImageContent } from '../../../components/message';
import { RenderMessageContent } from '../../../components/RenderMessageContent';
import { Image } from '../../../components/media';
import { ImageViewer } from '../../../components/image-viewer';
import { createMentionElement, moveCursor, useEditor } from '../../../components/editor';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';
import { useSetting } from '../../../state/hooks/settings';
import { MessageLayout, settingsAtom } from '../../../state/settings';
import { usePowerLevelsContext } from '../../../hooks/usePowerLevels';
import { useRoomCreators } from '../../../hooks/useRoomCreators';
import { useRoomPermissions } from '../../../hooks/useRoomPermissions';
import { useRoomCreatorsTag } from '../../../hooks/useRoomCreatorsTag';
import { usePowerLevelTags } from '../../../hooks/usePowerLevelTags';
import {
  useAccessiblePowerTagColors,
  useGetMemberPowerTag,
} from '../../../hooks/useMemberPowerTag';
import { useTheme } from '../../../hooks/useTheme';
import { useIsDirectRoom } from '../../../hooks/useRoom';
import { useImagePackRooms } from '../../../hooks/useImagePackRooms';
import { roomToParentsAtom } from '../../../state/room/roomToParents';
import { useMentionClickHandler } from '../../../hooks/useMentionClickHandler';
import { useSpoilerClickHandler } from '../../../hooks/useSpoilerClickHandler';
import { useOpenUserRoomProfile } from '../../../state/hooks/userRoomProfile';
import { useSpaceOptionally } from '../../../hooks/useSpace';
import { roomIdToReplyDraftAtomFamily } from '../../../state/room/roomInputDrafts';
import { openThreadAtom } from '../../../state/room/openThread';
import {
  factoryRenderLinkifyWithMention,
  getReactCustomHtmlParser,
  LINKIFY_OPTS,
  makeMentionCustomProps,
  renderMatrixMention,
} from '../../../plugins/react-custom-html-parser';
import {
  getEditedEvent,
  getEventReactions,
  getMemberDisplayName,
  getReactionContent,
} from '../../../utils/room';
import { eventWithShortcode, factoryEventSentBy, getMxIdLocalPart } from '../../../utils/matrix';
import { minuteDifference } from '../../../utils/time';
import { GetContentCallback, MessageEvent, StateEvent } from '../../../../types/matrix/room';
import { ContainerColor } from '../../../styles/ContainerColor.css';
import { sendReaction } from '../../../../client/privateReactions';
import { useSwipeToReply } from '../../../hooks/useSwipeToReply';
import { usePhone } from '../../../hooks/useScreenSize';
import { useHideActivity } from '../../../hooks/useActivityStatus';

type ThreadDrawerProps = {
  room: Room;
  rootId: string;
  mobile?: boolean;
};

const RENDERABLE = new Set<string>([
  MessageEvent.RoomMessage,
  MessageEvent.RoomMessageEncrypted,
  MessageEvent.Sticker,
]);

export function ThreadDrawer({ room, rootId, mobile }: ThreadDrawerProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const setOpenThread = useSetAtom(openThreadAtom);
  const editor = useEditor();
  const drawerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editId, setEditId] = useState<string>();

  const { root, replies, loading, error, hasOlder, loadOlder } = useThread(room, rootId);

  // Private reactions only become reactions once decrypted; redraw so replies show them.
  const [, setReactionTick] = useState(0);
  useEffect(() => {
    const handleDecrypted = (mEvent: MatrixEvent) => {
      if (mEvent.getRoomId() === room.roomId && mEvent.getType() === EventType.Reaction) {
        setReactionTick((t) => t + 1);
      }
    };
    mx.on(MatrixEventEvent.Decrypted, handleDecrypted);
    return () => {
      mx.removeListener(MatrixEventEvent.Decrypted, handleDecrypted);
    };
  }, [mx, room]);

  const [messageLayout] = useSetting(settingsAtom, 'messageLayout');
  const [messageSpacing] = useSetting(settingsAtom, 'messageSpacing');
  const [legacyUsernameColor] = useSetting(settingsAtom, 'legacyUsernameColor');
  const hideActivity = useHideActivity();
  const [mediaAutoLoad] = useSetting(settingsAtom, 'mediaAutoLoad');
  const [urlPreview] = useSetting(settingsAtom, 'urlPreview');
  const [encUrlPreview] = useSetting(settingsAtom, 'encUrlPreview');
  const showUrlPreview = room.hasEncryptionStateEvent() ? encUrlPreview : urlPreview;
  const [showDeveloperTools] = useSetting(settingsAtom, 'developerTools');
  const [hour24Clock] = useSetting(settingsAtom, 'hour24Clock');
  const [dateFormatString] = useSetting(settingsAtom, 'dateFormatString');
  const direct = useIsDirectRoom();

  const powerLevels = usePowerLevelsContext();
  const creators = useRoomCreators(room);
  const permissions = useRoomPermissions(creators, powerLevels);
  const canRedact = permissions.action('redact', mx.getSafeUserId());
  const canDeleteOwn = permissions.event(MessageEvent.RoomRedaction, mx.getSafeUserId());
  const canSendReaction = permissions.event(MessageEvent.Reaction, mx.getSafeUserId());
  const canPinEvent = permissions.stateEvent(StateEvent.RoomPinnedEvents, mx.getSafeUserId());
  const canMessage = permissions.event(MessageEvent.RoomMessage, mx.getSafeUserId());
  const phone = usePhone();

  const creatorsTag = useRoomCreatorsTag();
  const powerLevelTags = usePowerLevelTags(room, powerLevels);
  const getMemberPowerTag = useGetMemberPowerTag(room, creators, powerLevels);
  const theme = useTheme();
  const accessiblePowerTagColors = useAccessiblePowerTagColors(
    theme.kind,
    creatorsTag,
    powerLevelTags
  );

  const roomToParents = useAtomValue(roomToParentsAtom);
  const imagePackRooms: Room[] = useImagePackRooms(room.roomId, roomToParents);
  const mentionClickHandler = useMentionClickHandler(room.roomId);
  const spoilerClickHandler = useSpoilerClickHandler();
  const openUserRoomProfile = useOpenUserRoomProfile();
  const space = useSpaceOptionally();
  const setReplyDraft = useSetAtom(roomIdToReplyDraftAtomFamily(`${room.roomId}:thread:${rootId}`));

  const linkifyOpts = useMemo<LinkifyOpts>(
    () => ({
      ...LINKIFY_OPTS,
      render: factoryRenderLinkifyWithMention((href) =>
        renderMatrixMention(mx, room.roomId, href, makeMentionCustomProps(mentionClickHandler))
      ),
    }),
    [mx, room, mentionClickHandler]
  );
  const htmlReactParserOptions = useMemo<HTMLReactParserOptions>(
    () =>
      getReactCustomHtmlParser(mx, room.roomId, {
        linkifyOpts,
        useAuthentication,
        handleSpoilerClick: spoilerClickHandler,
        handleMentionClick: mentionClickHandler,
      }),
    [mx, room, linkifyOpts, spoilerClickHandler, mentionClickHandler, useAuthentication]
  );

  // Stick to the newest reply unless the user scrolled up to read history.
  const atBottomRef = useRef(true);
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [replies.length, root]);

  const handleUserClick: MouseEventHandler<HTMLButtonElement> = useCallback(
    (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      const userId = evt.currentTarget.getAttribute('data-user-id');
      if (!userId) return;
      openUserRoomProfile(
        room.roomId,
        space?.roomId,
        userId,
        evt.currentTarget.getBoundingClientRect(),
        'Left'
      );
    },
    [room, space, openUserRoomProfile]
  );

  const handleUsernameClick: MouseEventHandler<HTMLButtonElement> = useCallback(
    (evt) => {
      evt.preventDefault();
      const userId = evt.currentTarget.getAttribute('data-user-id');
      if (!userId) return;
      const name = getMemberDisplayName(room, userId) ?? getMxIdLocalPart(userId) ?? userId;
      editor.insertNode(
        createMentionElement(
          userId,
          name.startsWith('@') ? name : `@${name}`,
          userId === mx.getUserId()
        )
      );
      ReactEditor.focus(editor);
      moveCursor(editor);
    },
    [mx, room, editor]
  );

  const findEvent = useCallback(
    (eventId: string) =>
      room.findEventById(eventId) ??
      (root?.getId() === eventId ? root : replies.find((e) => e.getId() === eventId)),
    [room, root, replies]
  );

  const startReply = useCallback(
    (replyId: string) => {
      const replyEvt = findEvent(replyId);
      if (!replyEvt) return;
      if (replyId === rootId) {
        ReactEditor.focus(editor);
        return;
      }
      const edited = getEditedEvent(replyId, replyEvt, room.getUnfilteredTimelineSet());
      const content: IContent = edited?.getContent()['m.new_content'] ?? replyEvt.getContent();
      const { body, formatted_body: formattedBody } = content;
      const senderId = replyEvt.getSender();
      if (senderId && typeof body === 'string') {
        setReplyDraft({ userId: senderId, eventId: replyId, body, formattedBody });
        setTimeout(() => ReactEditor.focus(editor), 100);
      }
    },
    [room, rootId, editor, findEvent, setReplyDraft]
  );

  const handleReplyClick = useCallback(
    (evt: Parameters<MouseEventHandler<HTMLButtonElement>>[0]) => {
      const replyId = evt.currentTarget.getAttribute('data-event-id');
      if (replyId) startReply(replyId);
    },
    [startReply]
  );

  useSwipeToReply(
    scrollRef,
    phone && canMessage,
    useCallback(
      (eventId: string) => {
        const mEvent = findEvent(eventId);
        return (
          !!mEvent &&
          !mEvent.isState() &&
          !mEvent.isRedacted() &&
          (mEvent.getType() === MessageEvent.RoomMessage ||
            mEvent.getType() === MessageEvent.Sticker)
        );
      },
      [findEvent]
    ),
    startReply
  );

  const handleReactionToggle = useCallback(
    (targetEventId: string, key: string, shortcode?: string) => {
      const relations = getEventReactions(room.getUnfilteredTimelineSet(), targetEventId);
      const allReactions = relations?.getSortedAnnotationsByKey() ?? [];
      const [, reactionsSet] = allReactions.find(([k]) => k === key) ?? [];
      const reactions = reactionsSet ? Array.from(reactionsSet) : [];
      const myReaction = reactions.find(factoryEventSentBy(mx.getUserId()!));
      if (myReaction && !!myReaction?.isRelation()) {
        mx.redactEvent(room.roomId, myReaction.getId()!);
        return;
      }
      const rShortcode =
        shortcode ||
        (reactions.find(eventWithShortcode)?.getContent().shortcode as string | undefined);
      sendReaction(mx, room, getReactionContent(targetEventId, key, rShortcode));
    },
    [mx, room]
  );

  const handleEdit = useCallback(
    (editEvtId?: string) => {
      setEditId(editEvtId);
      if (!editEvtId) ReactEditor.focus(editor);
    },
    [editor]
  );

  const renderBody = (mEvent: MatrixEvent, mEventId: string) => {
    if (mEvent.isRedacted()) {
      return <RedactedContent reason={mEvent.getUnsigned().redacted_because?.content.reason} />;
    }
    if (mEvent.getType() === MessageEvent.Sticker) {
      return (
        <MSticker
          content={mEvent.getContent()}
          renderImageContent={(props) => (
            <ImageContent
              {...props}
              autoPlay={mediaAutoLoad}
              renderImage={(p) => <Image {...p} loading="lazy" />}
              renderViewer={(p) => <ImageViewer {...p} />}
            />
          )}
        />
      );
    }
    const timelineSet = room.getUnfilteredTimelineSet();
    const editedEvent = getEditedEvent(mEventId, mEvent, timelineSet);
    const getContent = (() =>
      editedEvent?.getContent()['m.new_content'] ?? mEvent.getContent()) as GetContentCallback;
    const senderId = mEvent.getSender() ?? '';
    return (
      <RenderMessageContent
        displayName={getMemberDisplayName(room, senderId) ?? getMxIdLocalPart(senderId) ?? senderId}
        msgType={mEvent.getContent().msgtype ?? ''}
        ts={mEvent.getTs()}
        edited={!!editedEvent}
        getContent={getContent}
        mediaAutoLoad={mediaAutoLoad}
        urlPreview={showUrlPreview}
        htmlReactParserOptions={htmlReactParserOptions}
        linkifyOpts={linkifyOpts}
        outlineAttachment={messageLayout === MessageLayout.Bubble}
      />
    );
  };

  const renderEvent = (mEvent: MatrixEvent, collapse: boolean) => {
    const mEventId = mEvent.getId();
    if (!mEventId || !RENDERABLE.has(mEvent.getType())) return null;
    const timelineSet = room.getUnfilteredTimelineSet();
    const reactionRelations = getEventReactions(timelineSet, mEventId);
    const hasReactions = !!reactionRelations?.getSortedAnnotationsByKey().length;
    const senderId = mEvent.getSender() ?? '';
    const relation = mEvent.getWireContent()['m.relates_to'];
    const replyEventId = relation?.is_falling_back ? undefined : mEvent.replyEventId;

    return (
      <Message
        key={mEventId}
        data-message-id={mEventId}
        room={room}
        mEvent={mEvent}
        messageSpacing={messageSpacing}
        messageLayout={messageLayout}
        collapse={collapse}
        highlight={false}
        edit={editId === mEventId}
        canDelete={canRedact || (canDeleteOwn && senderId === mx.getUserId())}
        canSendReaction={canSendReaction}
        canPinEvent={canPinEvent}
        imagePackRooms={imagePackRooms}
        relations={hasReactions ? reactionRelations : undefined}
        onUserClick={handleUserClick}
        onUsernameClick={handleUsernameClick}
        onReplyClick={handleReplyClick}
        onReactionToggle={handleReactionToggle}
        onEditId={handleEdit}
        reply={
          replyEventId &&
          replyEventId !== rootId && (
            <Reply
              room={room}
              timelineSet={timelineSet}
              replyEventId={replyEventId}
              getMemberPowerTag={getMemberPowerTag}
              accessibleTagColors={accessiblePowerTagColors}
              legacyUsernameColor={legacyUsernameColor || direct}
            />
          )
        }
        reactions={
          reactionRelations && (
            <Reactions
              style={{ marginTop: config.space.S200 }}
              room={room}
              relations={reactionRelations}
              mEventId={mEventId}
              canSendReaction={canSendReaction}
              onReactionToggle={handleReactionToggle}
            />
          )
        }
        hideReadReceipts={hideActivity}
        showDeveloperTools={showDeveloperTools}
        memberPowerTag={getMemberPowerTag(senderId)}
        accessibleTagColors={accessiblePowerTagColors}
        legacyUsernameColor={legacyUsernameColor || direct}
        hour24Clock={hour24Clock}
        dateFormatString={dateFormatString}
      >
        <EncryptedContent mEvent={mEvent}>{() => renderBody(mEvent, mEventId)}</EncryptedContent>
      </Message>
    );
  };

  const latestReplyId =
    [...replies]
      .reverse()
      .find((e) => !e.isRedacted())
      ?.getId() ?? undefined;
  const replyCount = replies.filter((e) => !e.isRedacted()).length;

  return (
    <Box
      ref={drawerRef}
      className={classNames(
        mobile ? css.ThreadDrawerMobile : css.ThreadDrawer,
        ContainerColor({ variant: 'Background' })
      )}
      shrink="No"
      grow={mobile ? 'Yes' : undefined}
      direction="Column"
    >
      <Header className={css.ThreadDrawerHeader} variant="Background" size="600">
        <Box grow="Yes" alignItems="Center" gap="200">
          <Icon size="200" src={Icons.Thread} />
          <Box grow="Yes" direction="Column">
            <Text size="H5" truncate>
              Thread
            </Text>
            <Text size="T200" priority="300" truncate>
              {room.name}
            </Text>
          </Box>
          <TooltipProvider
            position="Bottom"
            align="End"
            offset={4}
            tooltip={
              <Tooltip>
                <Text>Close</Text>
              </Tooltip>
            }
          >
            {(triggerRef) => (
              <IconButton
                ref={triggerRef}
                variant="Background"
                onClick={() => setOpenThread(undefined)}
                aria-label="Close thread"
              >
                <Icon src={Icons.Cross} />
              </IconButton>
            )}
          </TooltipProvider>
        </Box>
      </Header>

      <Box className={css.ThreadContentBase} grow="Yes">
        <Scroll
          ref={scrollRef}
          onScroll={handleScroll}
          variant="Background"
          size="300"
          visibility="Hover"
          hideTrack
        >
          <Box className={css.ThreadContent} direction="Column">
            {root ? renderEvent(root, false) : null}
            <Box className={css.ThreadRepliesDivider} alignItems="Center" gap="200">
              <Text size="L400" priority="300">
                {replyCount === 1 ? '1 reply' : `${replyCount} replies`}
              </Text>
              <Box grow="Yes">
                <Line variant="Surface" size="300" style={{ width: '100%' }} />
              </Box>
            </Box>
            {hasOlder && (
              <Box justifyContent="Center" className={css.ThreadStatus}>
                <Button
                  size="300"
                  variant="Secondary"
                  fill="Soft"
                  radii="300"
                  disabled={loading}
                  onClick={loadOlder}
                >
                  <Text size="B300">Load older replies</Text>
                </Button>
              </Box>
            )}
            {loading && replies.length === 0 && (
              <Box justifyContent="Center" className={css.ThreadStatus}>
                <Spinner variant="Secondary" size="400" />
              </Box>
            )}
            {error && (
              <Box direction="Column" alignItems="Center" gap="200" className={css.ThreadStatus}>
                <Text size="T300" priority="300" align="Center">
                  Couldn&apos;t load this thread.
                </Text>
                <Button size="300" variant="Secondary" fill="Soft" radii="300" onClick={loadOlder}>
                  <Text size="B300">Retry</Text>
                </Button>
              </Box>
            )}
            {replies.map((mEvent, i) => {
              const prev = replies[i - 1];
              const collapse =
                !!prev &&
                prev.getSender() === mEvent.getSender() &&
                minuteDifference(prev.getTs(), mEvent.getTs()) < 2;
              return renderEvent(mEvent, collapse);
            })}
          </Box>
        </Scroll>
      </Box>

      {canMessage && (
        <div className={css.ThreadInput}>
          <RoomInput
            room={room}
            roomId={room.roomId}
            editor={editor}
            fileDropContainerRef={drawerRef}
            threadRootId={rootId}
            threadLatestEventId={latestReplyId}
          />
        </div>
      )}
    </Box>
  );
}
