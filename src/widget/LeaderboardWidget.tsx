'use no memo'; // Widget JSX is rendered to RemoteViews, not React: no hooks allowed, so opt out of React Compiler memoisation.
/**
 * LeaderboardWidget (SPEC §12.2) — the centrepiece. 4×2 by default, resizable to 4×3.
 *
 *  🔒 LOCKIN' IN                 S3 · 4d left  🆘
 *  👑 [ava] Miguel      512   🔥34   ✓
 *  🥈 [ava] Jason       498   🔥29   ✓   ← you
 *  🥉 [ava] Ken         301   🔥6    ·
 *  12 pts to catch Miguel 🎯                 (if there's room)
 *  [        ✓  CHECK IN CLEAN          ]
 *
 * Sizes come from leaderboardLayout(height) so nothing (least of all the button) gets clipped.
 */
import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { copy } from '@/copy/en';

import type { WidgetButton } from './buttonState';
import { leaderboardLayout, type LeaderboardLayout } from './layout';
import { FONT_BODY, FONT_DISPLAY, Pixel, shortName, statusIcon, W, WidgetAvatar, WidgetButtonPill } from './parts';
import type { WidgetMember, WidgetSnapshot } from './snapshot';

export type LeaderboardWidgetProps = {
  snapshot: WidgetSnapshot | null;
  button: WidgetButton;
  stale: string | null;
  /** Widget height in dp, from the launcher. */
  height: number;
};

const MEDALS: Record<number, string> = { 1: 'medal/1', 2: 'medal/2', 3: 'medal/3' };
const SECTION_GAP = 4;

function Row({ member, isMe, layout }: { member: WidgetMember; isMe: boolean; layout: LeaderboardLayout }) {
  const small = layout.rowHeight < 26;
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: 'match_parent',
        height: layout.rowHeight,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        borderRadius: Math.round(layout.rowHeight / 2),
        backgroundColor: isMe ? W.rowMe : W.row,
        borderWidth: isMe ? 1 : 0,
        borderColor: W.aqua,
        flexGap: 6,
      }}
    >
      {MEDALS[member.position] ? (
        <Pixel name={MEDALS[member.position] ?? 'medal/1'} size={small ? 15 : 18} />
      ) : (
        <TextWidget text={String(member.position)} style={{ fontFamily: FONT_DISPLAY, fontSize: 15, color: W.muted, width: 16, textAlign: 'center' }} />
      )}
      <WidgetAvatar layers={member.avatarLayers} size={layout.avatar} />
      <FlexWidget style={{ flex: 1 }}>
        <TextWidget text={shortName(member.name)} style={{ fontFamily: FONT_BODY, fontSize: small ? 12 : 14, color: isMe ? W.aqua : W.text }} maxLines={1} truncate="END" />
      </FlexWidget>
      <TextWidget text={String(member.score30d)} style={{ fontFamily: FONT_DISPLAY, fontSize: small ? 17 : 20, color: W.text }} />
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 40 }}>
        <Pixel name={`flame/tier${member.flameTier}`} size={small ? 12 : 14} />
        <TextWidget text={String(member.streak)} style={{ fontFamily: FONT_DISPLAY, fontSize: small ? 15 : 16, color: member.flameTier === 4 ? W.aqua : W.gold }} />
      </FlexWidget>
      <Pixel name={statusIcon(member.todayStatus)} size={small ? 14 : 16} />
    </FlexWidget>
  );
}

function XPLine({ me }: { me: WidgetMember }) {
  const fraction = me.xp.next === null ? 1 : me.xp.next <= 0 ? 0 : Math.min(1, me.xp.current / me.xp.next);
  const filled = Math.round(fraction * 10);
  return (
    <FlexWidget style={{ width: 'match_parent', height: 14, flexDirection: 'row', alignItems: 'center', flexGap: 6 }}>
      <TextWidget text={me.rank.toUpperCase()} style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: W.muted }} />
      <FlexWidget style={{ flex: 1, flexDirection: 'row', flexGap: 2, padding: 2, borderRadius: 7, backgroundColor: '#050D24' }}>
        {Array.from({ length: 10 }, (_, i) => (
          <FlexWidget key={i} style={{ flex: 1, height: 6, borderRadius: 2, backgroundColor: i < filled ? W.aqua : '#16306F' }} />
        ))}
      </FlexWidget>
      <TextWidget text={me.xp.next === null ? 'MAX' : `${me.xp.current}/${me.xp.next}`} style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: W.muted }} />
    </FlexWidget>
  );
}

function Line({ text, colour }: { text: string; colour: `#${string}` }) {
  return (
    <FlexWidget style={{ width: 'match_parent', height: 16, justifyContent: 'center' }}>
      <TextWidget text={text} style={{ fontFamily: FONT_BODY, fontSize: 12, color: colour }} maxLines={1} truncate="END" />
    </FlexWidget>
  );
}

/** Top 3, plus your row if you're not in it (SPEC §12.2). */
export function visibleRows(members: WidgetMember[], myUid: string, limit = 3): WidgetMember[] {
  const top = members.slice(0, limit);
  const me = members.find((m) => m.uid === myUid);
  return me && !top.includes(me) ? [...top.slice(0, limit - 1), me] : top;
}

export function LeaderboardWidget({ snapshot, button, stale, height }: LeaderboardWidgetProps) {
  const myUid = snapshot?.me.uid ?? '';
  const rows = snapshot ? visibleRows(snapshot.members, myUid) : [];
  const layout = leaderboardLayout(height, Math.max(rows.length, 1));
  const me = snapshot?.members.find((m) => m.uid === myUid);

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: 'column',
        padding: layout.padding,
        borderRadius: 26,
        backgroundGradient: { from: W.bgTop, to: W.bgBottom, orientation: 'TOP_BOTTOM' },
        flexGap: SECTION_GAP,
      }}
    >
      {/* Header */}
      <FlexWidget style={{ width: 'match_parent', height: layout.headerHeight, flexDirection: 'row', alignItems: 'center', flexGap: 6 }}>
        <Pixel name="brand/padlock" size={16} />
        <TextWidget text={copy.widget.brand} style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: W.text }} />
        <FlexWidget style={{ flex: 1, alignItems: 'flex-end' }}>
          <TextWidget
            text={stale ?? (snapshot?.season ? copy.widget.season(snapshot.season.number, snapshot.season.daysLeft) : '')}
            style={{ fontFamily: FONT_DISPLAY, fontSize: 15, color: stale ? W.gold : W.aqua }}
            maxLines={1}
          />
        </FlexWidget>
        {/* M6 points this at the SOS screen (lockinin://sos). */}
        <FlexWidget clickAction="OPEN_APP" accessibilityLabel="SOS" style={{ padding: 1 }}>
          <Pixel name="icon/sos" size={19} />
        </FlexWidget>
      </FlexWidget>

      {/* SOS banner (M6) replaces the rival line */}
      {snapshot?.activeSos ? (
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: `lockinin://sos/${snapshot.activeSos.id}/respond` }}
          style={{ width: 'match_parent', height: 18, borderRadius: 9, backgroundColor: W.slipped, alignItems: 'center', justifyContent: 'center' }}
        >
          <TextWidget text={copy.widget.sosBanner(snapshot.activeSos.name)} style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: '#FFFFFF' }} />
        </FlexWidget>
      ) : null}

      {/* Rows */}
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', flexGap: layout.rowGap }}>
        {rows.length ? (
          rows.map((m) => <Row key={m.uid} member={m} isMe={m.uid === myUid} layout={layout} />)
        ) : (
          <Line text={copy.widget.noCrew} colour={W.muted} />
        )}
      </FlexWidget>

      {layout.showXp && me ? <XPLine me={me} /> : null}
      {layout.showRival && snapshot?.rival && !snapshot.activeSos ? <Line text={snapshot.rival.text} colour={W.muted} /> : null}
      {layout.showLastEvent && snapshot?.lastEvent ? <Line text={snapshot.lastEvent.text} colour={W.faint} /> : null}

      <WidgetButtonPill button={button} height={layout.buttonHeight} fontSize={layout.buttonFont} />
    </FlexWidget>
  );
}
