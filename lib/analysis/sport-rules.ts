import type { Locale } from '../match-types';
import type { AnalysisPoint, AnalysisSource } from './types';
import type { IndividualSport } from './individual-types';
export const TARGET_SPORTS = ['gymnastics','swimming','athletics','diving','cricket'] as const;
export function normalizeSport(sport: string): string {
  const key=sport.trim().toLowerCase().replace(/[_-]/g,' ').replace(/\s+/g,' ');
  if (/^(artistic )?gymnastics$|^体操$/.test(key)) return 'gymnastics';
  if (/^(track( and| &)? field|track|field|athletics)$|^田径$/.test(key)) return 'athletics';
  if (/^swimming$|^游泳$/.test(key)) return 'swimming';
  if (/^diving$|^跳水$/.test(key)) return 'diving';
  if (/^cricket$|^板球$/.test(key)) return 'cricket';
  return key;
}
export function isIndividualSport(sport: string): sport is IndividualSport { return ['gymnastics','swimming','athletics','diving'].includes(sport); }
const rules: Record<string,{source:{label:string;url:string};en:{title:string;summary:string;detail:string};zh:{title:string;summary:string;detail:string}}> = {
  diving:{source:{label:'World Aquatics · competition regulations',url:'https://www.worldaquatics.com/rules/competition-regulations'},en:{title:'How diving scores work',summary:'Difficulty and execution both matter.',detail:'Individual diving combines the retained execution awards with the dive’s difficulty. The judge count and discipline determine which awards are retained; synchronised diving uses a different calculation. A still image cannot establish why judges deducted marks.'},zh:{title:'跳水如何计分',summary:'难度和完成评分共同决定动作分。',detail:'个人跳水把保留的完成评分与动作难度结合计算；保留哪些评分取决于裁判人数和具体分项，双人同步跳水采用不同计算。单张照片无法说明裁判为何扣分。'}},
  swimming:{source:{label:'World Aquatics · swimming regulations',url:'https://www.worldaquatics.com/rules/competition-regulations'},en:{title:'Reading a swimming result',summary:'Compare valid finish times in the same event and round.',detail:'A lower valid finish time places ahead of a higher one in a timed race. Final placings depend on official results, including disqualifications and ties. A split is an intermediate time, not a finish result; compare like-for-like distances and rounds.'},zh:{title:'看懂游泳成绩',summary:'在同一项目、同一轮次中比较有效完赛时间。',detail:'计时比赛中，有效用时越短越靠前；最终名次以官方记录为准，包括并列和取消资格。分段成绩是中途计时，不能当成完赛时间；应比较相同距离与轮次。'}},
  gymnastics:{source:{label:'World Gymnastics · codes of points',url:'https://www.gymnastics.sport/site/rules/index.php'},en:{title:'Difficulty, execution, deductions',summary:'Artistic gymnastics separates difficulty from execution.',detail:'In artistic gymnastics, difficulty and execution contribute to the score, with applicable neutral penalties deducted. An all-around total combines apparatus results. Rhythmic and trampoline scoring differ. A total alone does not reveal individual deductions or a physical mistake.'},zh:{title:'难度、完成与扣分',summary:'竞技体操把难度与完成质量分别计入成绩。',detail:'竞技体操计入难度分与完成分，再扣除适用的中性罚分；全能总分汇总各器械成绩。艺术体操和蹦床采用不同体系，不能套用同一个公式。只有总分时，无法解释每一项扣分或认定具体失误。'}},
  athletics:{source:{label:'World Athletics · technical rules',url:'https://worldathletics.org/about-iaaf/documents/technical-information'},en:{title:'Time, distance, or points?',summary:'Track races, field events and combined events measure different things.',detail:'Track races compare valid finish times; jumps and throws compare valid heights or distances. Combined events use points across several disciplines. Qualification marks and final placings are different records. A still photo cannot establish a false start or a foul.'},zh:{title:'比时间、距离，还是积分？',summary:'径赛、田赛和全能项目，比较的指标不同。',detail:'径赛比较有效完赛时间，跳跃和投掷比较有效高度或距离，全能项目汇总多项积分。资格成绩与决赛名次是不同记录。仅凭一张照片不能认定抢跑或犯规。'}},
  cricket:{source:{label:'MCC · Laws of Cricket',url:'https://www.lords.org/mcc/about-the-laws-of-cricket'},en:{title:'Runs, wickets and overs',summary:'A score such as 120/3 means runs scored and wickets lost.',detail:'An over contains six valid deliveries. A notation such as 15.4 means fifteen completed overs plus four valid balls, not a decimal. Wides and no-balls affect runs and do not count as one of those six valid deliveries. Match format and target determine how much play remains.'},zh:{title:'跑分、出局与轮次',summary:'例如 120/3，表示得到的跑分和损失的三柱门数。',detail:'一轮包含六次有效投球；15.4 表示完成十五轮再加四次有效球，不是小数。宽球和无效球会影响跑分，但不计入这六次有效球。还剩多少比赛，要结合赛制和追分目标判断。'}},
};
export function sportRulePoint(sport: string, locale: Locale): {point:AnalysisPoint;source:AnalysisSource}|null {
  const rule=rules[normalizeSport(sport)];if(!rule)return null;
  const prose=rule[locale];const id=`rules-${normalizeSport(sport)}`;
  return {point:{id,kind:'rule',x:.2,y:.82,...prose,evidence:'rule',sourceIds:[id]},source:{id,...rule.source,fetchedAt:'2026-10-15T09:04:04Z',kind:'rule'}};
}
