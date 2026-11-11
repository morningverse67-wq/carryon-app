// 11-11 사장님 "두 개 다 합쳐서 배포 … 하나만": preview.carryon-app.pages.dev로 들어와도
// 본 주소 하나로 보냄. 경로·쿼리(관리자 키 포함)는 그대로 넘김.
const HOME = "carryon-app.pages.dev";
export const onRequest = ({ request, next }) => {
  const u = new URL(request.url);
  if (u.hostname === "preview." + HOME) {  // 배포별 주소(<id>.)는 시험용으로 남김
    u.hostname = HOME;
    return Response.redirect(u.toString(), 301);
  }
  return next();
};
