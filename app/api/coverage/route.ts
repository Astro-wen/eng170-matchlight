import { jsonResponse } from '../../../lib/matches/http';
import { DATA_COVERAGE } from '../../../lib/analysis/coverage';
export async function GET(){return jsonResponse({sports:DATA_COVERAGE,ruleReferencesForAll:true,liveGuarantee:false,note:'A connected public lookup is not guaranteed live coverage. Paris 2024 results remain historical; missing details are never inferred.'});}
