/* Account setup stage: all existing tools are unlocked.
 * Payment processing and subscriptions are intentionally NOT part of this release.
 */
(function () {
  "use strict";
  var plan={id:"demo",name:"Local Demo",price:0,animalLimit:Number.MAX_SAFE_INTEGER,
    features:{familyTree:true,operations:true,reports:true,moneyStats:true,advancedIntelligence:true,multiFarm:true,teamManagement:true}};
  var subscription={plan:"demo",status:"local-demo",current_period_end:null,cancel_at_period_end:false};
  function getCount(){try{var a=JSON.parse(localStorage.getItem("livestockAnimals")||"[]");return Array.isArray(a)?a.length:0;}catch(e){return 0;}}
  window.LivestockSubscription={
    PLANS:{demo:plan},load:function(){return Promise.resolve(subscription);},
    getSubscription:function(){return subscription;},getPlan:function(){return plan;},effectivePlan:function(){return "demo";},
    hasFeature:function(){return true;},canAddAnimal:function(){return true;},getAnimalsCount:getCount,
    isReady:function(){return true;},enforce:function(){},
    checkout:function(){return Promise.reject(new Error("Subscriptions are not connected yet; farm tools are available for testing."));}
  };
})();
