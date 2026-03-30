const { action: dailyGift } = require('./daily-gift');
const { action: friendFight } = require('./friend-fight');
const { action: friendInfo } = require('./friend-info');
const { action: store } = require('./store');
const { action: wulin } = require('./wulin');
const { action: tenLottery } = require('./ten-lottery');
const { action: knightFight } = require('./knight-fight');
const { action: towerFight } = require('./tower-fight');
const { action: callbackRecall } = require('./callback-recall');
const { action: adventure } = require('./adventure');
const { action: task } = require('./task');
const { action: zodiac } = require('./zodiac');
const { action: cargo } = require('./cargo');
const { action: faction } = require('./faction');
const { action: misty } = require('./misty');
const { action: formation } = require('./formation');
const { action: worldTree } = require('./world-tree');
const { action: spaceRelic } = require('./space-relic');
const { action: scrollDungeon } = require('./scroll-dungeon');
const { action: sect } = require('./sect');
const { action: dragonPhoenix } = require('./dragon-phoenix');
const { action: knightIsland } = require('./knight-island');
const { action: abyssTide } = require('./abyss-tide');
const { action: peakFight } = require('./peak-fight');
const { action: livenessGift } = require('./liveness-gift');
const { action: enchant } = require('./enchant');
const { action: ascendHeaven } = require('./ascend-heaven');
const { action: immortals } = require('./immortals');
const { action: wish } = require('./wish');
const { action: altar } = require('./altar');
const { action: missionAssign } = require('./mission-assign');

const actions = new Map([
  ['dailygift', dailyGift],
  ['friendfight', friendFight],
  ['friendinfo', friendInfo],
  ['store', store],
  ['wulin', wulin],
  ['tenlottery', tenLottery],
  ['knightfight', knightFight],
  ['towerfight', towerFight],
  ['callbackrecall', callbackRecall],
  ['adventure', adventure],
  ['task', task],
  ['zodiac', zodiac],
  ['cargo', cargo],
  ['faction', faction],
  ['misty', misty],
  ['formation', formation],
  ['worldtree', worldTree],
  ['spacerelic', spaceRelic],
  ['scrolldungeon', scrollDungeon],
  ['sect', sect],
  ['dragonphoenix', dragonPhoenix],
  ['knightisland', knightIsland],
  ['abysstide', abyssTide],
  ['peakfight', peakFight],
  ['livenessgift', livenessGift],
  ['enchant', enchant],
  ['ascendheaven', ascendHeaven],
  ['immortals', immortals],
  ['wish', wish],
  ['altar', altar],
  ['missionassign', missionAssign],
]);

function getAction(id) {
  return actions.get(id);
}

function getAllActions() {
  return Array.from(actions.entries()).map(([id, action]) => ({
    id,
    name: action.name,
    description: action.description,
    category: action.category,
  }));
}

module.exports = {
  actions,
  getAction,
  getAllActions,
  dailyGift,
  friendFight,
  friendInfo,
  wish,
  missionAssign,
};