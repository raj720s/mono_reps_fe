
import {Button} from '@fe_standard/ui'
import './App.css'
import {formatCurrency} from '@fe_standard/utils'

function App() {
  const price = 1234.56;

  return (
  <>
  <h1>hi</h1>
    <Button />
    <p>{formatCurrency(price)}</p>
  </>
  )
}

export default App
