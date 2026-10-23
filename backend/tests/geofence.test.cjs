const {test}=require('node:test');const assert=require('node:assert/strict');
Object.assign(process.env,{SUPABASE_URL:'https://yurdfoblkaclivxqfpjt.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_test'});
const {checkLocation,distanceMeters,locationSchema,geofenceSchema}=require('../dist/services/geofence');
const fix={latitude:12.9,longitude:77.5,accuracy:10,capturedAt:100000,platform:'android',mocked:false,developerOptions:'unavailable'};
const campus={enabled:true,latitude:12.9,longitude:77.5,radiusM:200};
test('a recent native GPS fix wholly inside campus is accepted',()=>{assert.equal(checkLocation(fix,campus,100000).distanceM,0);assert.equal(distanceMeters(fix,fix),0);});
test('outside, stale, uncertain, mocked and unchecked device locations are blocked',()=>{for(const bad of [{...fix,latitude:13},{...fix,capturedAt:1},{...fix,capturedAt:120000},{...fix,accuracy:150},{...fix,mocked:true},{...fix,mocked:null},{...fix,platform:'web'}])assert.ok(checkLocation(bad,campus,100000).error);});
test('a disabled fence still rejects stale or reported mock location',()=>{assert.equal(checkLocation({...fix,platform:'web',mocked:null},{enabled:false},100000).distanceM,null);assert.ok(checkLocation({...fix,mocked:true},{enabled:false},100000).error);});
test('invalid coordinates, forged developer-options status and invalid radii are rejected',()=>{assert.equal(locationSchema.safeParse({...fix,latitude:91}).success,false);assert.equal(locationSchema.safeParse({...fix,developerOptions:'off'}).success,false);assert.equal(geofenceSchema.safeParse({...campus,radiusM:0}).success,false);});
