import {createConstants, createReducer} from 'redux-module-builder'
import * as firebase from 'firebase'
require('firebase/firestore')
import {firebaseConfig} from '../../js'

const types = createConstants('FIREBASE_INTEGRATION')(
  'INIT','SIGNIN','CREATE_UPDATE', 'FETCH', 'AUTH_VALIDATION',
  'PERM_SIGNIN','DELETE','FETCH_REALTIME','FETCH_RELATED'
)

export const reducers = createReducer({
  [types.INIT]: (state,action) => ({...state,initialized:action.initialized,error:action.error}),
  [types.SIGNIN]: (state,action) => (
    {
      ...state,
      signedIn:action.initialized,
      user:action.user,
      token:action.token,
      firebaseLoading:action.loading
    }
  ),
  [types.CREATE_UPDATE] : (state,action) => (
    {
      ...state,
      firebaseLoading:action.loading,
      successcreate:action.successcreate,
      error:action.error
    }
  ),
  [types.DELETE] : (state,action) => (
    {
      ...state,
      firebaseLoading:action.loading,
      successdelete:action.successdelete,
      successcreate:action.successcreate,
      error:action.error
    }
  ),
  [types.FETCH] : (state,action) => (
    {
      ...state,
      firebaseLoading:action.loading,
      successfetch:action.successfetch,
      error:action.error
    }
  ),
  [types.FETCH_RELATED] : (state,action) => (
    {
      ...state,
      relatedData:action.relatedData,
      successfetch:action.successrtfetch,
      firebaseLoading:action.loading,
      error:action.error
    }
  ),
  [types.FETCH_REALTIME] : (state,action) => (
    {
      ...state,
      realTimeData:action.realTimeData,
      successrtfetch:action.successrtfetch,
      error:action.error
    }
  ),
  [types.AUTH_VALIDATION] : (state,action) => (
    {
      ...state,
      signedIn:action.signedIn,
      firebaseLoading:action.loading,
      user:action.user,
      token:action.token
    }
  ),
  [types.PERM_SIGNIN] : (state,action) => ({...state})
})

export const actions = {
  init: () => (dispatch) => {
    try{
      firebase.initializeApp(firebaseConfig())
      firebase.auth().useDeviceLanguage()
      dispatch({type: types.INIT,initialized:true,error:null})
      return true
    }catch(e){
      dispatch({type: types.INIT,initialized:false,error:e})
      return false
    }
  },
  execSignInPopup: (mod) => (dispatch) => {
    return new Promise( (resolve,reject) => {
      dispatch({type:types.SIGNIN,signedIn:false,user:null,loading:true})
      firebase.auth()
        .signInWithPopup(mod==process.env.FLAG_GOOGLE_SIGNIN?firebaseGoogleProvider():firebaseFacebookProvider())
        .then( result => {
          result.user.token = result.credential.accessToken
          const {token,displayName,email,photoURL} = result.user
          dispatch({type:types.SIGNIN,signedIn:true,user:result.user,loading:false})
          resolve({token,displayName,email,photoURL})
        }).catch( error => {
          dispatch({type:types.SIGNIN,signedIn:false,user:null,loading:false})
          reject(error)
        })
    } )
  },
  onAuthStateChanged: (cb) => (dispatch) => {
    dispatch({type:types.AUTH_VALIDATION,signedIn:false,loading:true,user:null,token:null})
    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        const {displayName,photoURL,email,refreshToken} = user
        user.token = refreshToken
        user.path = `users/${email}`
        dispatch({type:types.AUTH_VALIDATION,signedIn:true,loading:false,user:{displayName,photoURL,email},token:null})
        if(cb) cb(user)
      }else{
        dispatch({type:types.AUTH_VALIDATION,signedIn:false,loading:false,user:null,token:null})
        if(cb) cb(null)
      }
    })
  },
  putDataRequest: (path,record) => (dispatch) => {
    dispatch({ type: types.CREATE_UPDATE, loading:true, successcreate:false, error:null })
    return new Promise( (resolve,reject) => {
      docRef(path).set(record)
        .then( data => {
          dispatch({ type: types.CREATE_UPDATE, loading:false, successcreate:true, error:null })
          resolve(data)
        } )
        .catch( err => {
          dispatch({ type: types.CREATE_UPDATE, loading:false, successcreate:false, error:err })
          reject(err)
        } )
    } )
  },
  deleteDataRequest: (path) => (dispatch) => {
    dispatch({ type: types.DELETE, loading:true, successdelete:false, error:null })
    return new Promise( (resolve,reject) => {
      docRef(path).delete()
        .then( data => {
          dispatch({ type: types.DELETE, loading:false, successdelete:true, successcreate:false, error:null })
          resolve(data)
        } )
        .catch( err => {
          dispatch({ type: types.DELETE, loading:false, successdelete:false, successcreate:false, error:err })
          reject(err)
        } )
    } )
  },
  fetchData: (path) => (dispatch) => {
    dispatch({ type: types.FETCH, loading:true, successfetch:false, error:null })
    return new Promise( (resolve,reject) => {
      docRef(path).get()
        .then( doc => {
          if(doc && doc.exists){
            const {displayName,photoURL,token} = doc.data()
            dispatch({ type: types.FETCH, loading:false, successfetch:true,
              error:null, user:{displayName,photoURL}, token })
            resolve(doc.data())
          }
        } )
        .catch( err => {
          dispatch({ type: types.FETCH, loading:false, successfetch:false, error:err })
          reject(err)
        } )
    } )
  },
  fetchRelatedData: (path,field,op,val) => (dispatch) => {
    dispatch({ type: types.FETCH, loading:true, successfetch:false, error:null })
    return new Promise( (resolve,reject) => {
      colRef(path).where(field,op,val).get()
        .then( result => {
          const finalResp = result.docs.map( item => ({...item.data()}) )
          dispatch({ type: types.FETCH_RELATED, successfetch:(result.docs.length>0),
            error:(result.docs.length>0?null:'No result'), relatedData:(result.docs.length>0?finalResp:null) })
          resolve(result.docs.length>0?finalResp:null)
        } )
        .catch( err => {
          dispatch({ type: types.FETCH_RELATED, loading:false, successfetch:false, error:err })
          reject(err)
        } )
    } )
  },
  fetchRealtimeData: (path) => (dispatch) => {
    dispatch({ type: types.FETCH_REALTIME, successrtfetch:false })
    return new Promise( (resolve,reject) => {
      colRef(path).onSnapshot( result => {
        const finalResp = result.docs.map( item => ({id:item.id,data:{ ...item.data() }}) )
        dispatch({ type: types.FETCH_REALTIME, successrtfetch:(result.docs.length>0),
          error:(result.docs.length>0?null:'No result'), realTimeData:(result.docs.length>0?finalResp:null) })
        if(result.docs.length>0) resolve(true)
        else reject('No result')
      } )
    } )
  },
}

const fireStore = () => firebase.firestore()

const docRef = (path) => fireStore().doc(path)
const colRef = (path) => fireStore().collection(path)

const firebaseGoogleProvider = () => {
  const provider = new firebase.auth.GoogleAuthProvider()
  provider.addScope(process.env.GOOGLE_SCOPE_URL)
  return provider
}
const firebaseFacebookProvider = () => {
  const provider = new firebase.auth.FacebookAuthProvider()
  provider.addScope('public_profile')
  return provider
}
