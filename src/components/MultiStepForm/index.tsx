import { useAppState } from '../../store'
import StepIndicator from './StepIndicator'
import Step1TripInfo from './Step1TripInfo'
import Step2Attractions from './Step2Attractions'
import Step3Restaurants from './Step3Restaurants'
import Step4Accommodation from './Step4Accommodation'
import Step5Review from './Step5Review'

export default function MultiStepForm() {
  const { currentStep } = useAppState()

  return (
    <div className="max-w-2xl mx-auto">
      <StepIndicator current={currentStep} />
      {currentStep === 1 && <Step1TripInfo />}
      {currentStep === 2 && <Step2Attractions />}
      {currentStep === 3 && <Step3Restaurants />}
      {currentStep === 4 && <Step4Accommodation />}
      {currentStep === 5 && <Step5Review />}
    </div>
  )
}
