/* This object represent a fix-float swap
 * the floating leg:
 * receive 1 at the beginning
 * pay a float rate all along
 * pay 1 at the end
 * the fixed leg:
 * pay 1 at the beginning
 * receive a fix coupon 'r' all along
 * receive 1 at the end
 */
class Swap {
  constructor(T,dt,r){
    this.T = T; // maturity
    this.dt = dt; // time between two coupon
    this.r = r; // fix rate to be payed
  }

  /* Following the hypothesis than our swap is with a risk free floating rate:
   * the floating leg worth 0
   * the fixed leg worth something and is computed in this function
   */
  price(curve){
    let t = this.T;
    if(t < 0) return;
    let dt = this.dt;
    let r = this.r;
    let V = 1*curve.df(t); // receive 1 at the end
    while(t > 0){
      let C = r*(t<dt?t:dt);
      V += C*curve.df(t); // receive coupon of r*dt all along
      t -= dt;
    }
    return V-1; // pay 1 at the beginning
  }
}