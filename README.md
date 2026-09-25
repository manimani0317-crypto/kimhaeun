# kimhaeun

김하은 UX/UI 퍼스널 포트폴리오 사이트.

**미싱(재봉틀) 컨셉** — 책상을 위에서 내려다본 화면에 오브젝트가 흩어져 있고, 하나씩 누르면 작업물로 들어간다. 정적인 페이지가 아니라 Three.js 기반의 인터랙션 중심 웹. 지금은 오브젝트를 하나씩 만들어 붙이는 단계다.

## 작업 문서

기획·컬러·진행 상황·다음 할 일은 전부 여기에 있다. **작업 시작 전에 이것부터 읽는다.**

→ [readme/3DREADME.md](readme/3DREADME.md)

이 README는 입구일 뿐이고, 내용이 어긋나면 3DREADME 쪽이 맞다.

## 실행

3D 파일은 `type="module"`이라 **더블클릭하면 안 열린다.** 이 폴더에서 로컬 서버를 띄운다.

```bash
npx serve .
```

그다음 브라우저에서:

| 오브젝트 | 주소 |
| --- | --- |
| 단추 | `http://localhost:3000/assets/main/button/buttonFinal.html` |
| 실패 | `http://localhost:3000/assets/main/threadSpool/threadSpool3d.html` |
| 바늘꽂이 | `http://localhost:3000/assets/main/pinCushion/pinCushion3d.html?az=0` |
| 미싱 | `http://localhost:3000/assets/main/sewingMachine3dDetailed.html` |
| 실 결 그리기 | `http://localhost:3000/assets/main/threadTexturePainter.html` |

바늘꽂이의 `az=`는 보는 각도 고정 (0 정면 / 90·-90 옆면).

## 지금 상태

단추·실패 완료, 미싱 1차 완료, 바늘꽂이 작업 중, 메인 화면은 아직 조립 전.
자세한 건 [3DREADME 6번](readme/3DREADME.md) 참고.

## 기술

Three.js 0.160 (CDN에서 불러옴). 설치할 라이브러리 없음.

## 폴더

```
index.html      임시 입구 (미싱 뷰어). 실제 메인이 생기면 교체
assets/main/    오브젝트별 3D 파일
readme/         작업 문서와 레퍼런스
```

파일·폴더 이름은 전부 영어 카멜표기, 언더바·띄어쓰기 없음.
